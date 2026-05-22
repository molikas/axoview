import { useCallback, useState } from 'react';
import { InitialData, IconCollectionState } from 'src/types';
import type { LoadOptions } from 'src/types/axoviewProps';
import {
  INITIAL_DATA,
  INITIAL_SCENE_STATE,
  INITIAL_UI_STATE
} from 'src/config';
import {
  getFitToViewParams,
  CoordsUtils,
  categoriseIcons,
  generateId,
  getItemByIdOrThrow
} from 'src/utils';
import * as reducers from 'src/stores/reducers';
import { useModelStore } from 'src/stores/modelStore';
import { useView } from 'src/hooks/useView';
import { useUiStateStore, useUiStateStoreApi } from 'src/stores/uiStateStore';
import { modelSchema } from 'src/schemas/model';
import { mergeBundledFixtures } from 'src/utils/leanSave';

// Must match the threshold in IconCollection.tsx so newly-loaded large packs
// (e.g. Material Icons) are not auto-expanded (which would freeze the browser).
const LARGE_PACK_THRESHOLD = 100;

export const useInitialDataManager = () => {
  const [isReady, setIsReady] = useState(false);
  const modelActions = useModelStore((state) => state.actions);
  const modelIcons = useModelStore((state) => state.icons);
  const modelColors = useModelStore((state) => state.colors);
  const uiStateActions = useUiStateStore((state) => state.actions);
  const { changeView } = useView();
  const uiStateStoreApi = useUiStateStoreApi();

  const load = useCallback(
    (_initialData: InitialData, options?: LoadOptions) => {
      if (!_initialData) return;

      setIsReady(false);

      try {
        // Normalise and clean up data before validation.
        // Work on a plain-object copy so we can safely mutate without TS complaints.
        const rawData: Record<string, any> = { ..._initialData };

        rawData.views = ((rawData.views ?? []) as any[]).map((view: any) => {
          // Normalise: some diagrams use 'title' instead of 'name' for views
          const normView: any = { ...view };
          if (!normView.name && normView.title) {
            normView.name = normView.title;
          }

          if (!normView.connectors) return normView;

          const validConnectors = (normView.connectors as any[]).filter(
            (connector: any) => {
              const hasValidAnchors = (connector.anchors as any[]).every(
                (anchor: any) => {
                  // Reject anchors with empty refs (can happen from a broken paste operation)
                  const refKeys = Object.keys(anchor.ref ?? {});
                  if (refKeys.length === 0) return false;
                  if (anchor.ref.item) {
                    return (normView.items as any[]).some(
                      (item: any) => item.id === anchor.ref.item
                    );
                  }
                  return true;
                }
              );

              if (!hasValidAnchors) {
                console.warn(
                  `Removing connector ${connector.id} due to invalid item references`
                );
              }

              return hasValidAnchors;
            }
          );

          return { ...normView, connectors: validConnectors };
        });

        // Re-type after normalisation — Zod will validate the structure next
        const initialData = rawData as unknown as typeof _initialData;

        // Validate
        const validationResult = modelSchema.safeParse(initialData);

        if (!validationResult.success) {
          console.error(
            '[useInitialDataManager] Model validation failed:',
            validationResult.error.issues
          );
          console.error(
            '[useInitialDataManager] Validation error detail:',
            JSON.stringify(validationResult.error.issues, null, 2)
          );

          // Per UX §6.3 — surface validation failures to the user, not just devtools.
          const summary = validationResult.error.issues
            .slice(0, 2)
            .map((issue) => {
              const path = issue.path.length ? issue.path.join('.') : '(root)';
              return `${path}: ${issue.message}`;
            })
            .join('; ');

          uiStateActions.setNotification({
            severity: 'error',
            message: `Could not load diagram: ${summary || 'unknown validation error'}`
          });

          setIsReady(false);
          return;
        }

        if (initialData.views.length === 0) {
          const updates = reducers.view({
            action: 'CREATE_VIEW',
            payload: {},
            ctx: {
              state: { model: initialData, scene: INITIAL_SCENE_STATE },
              viewId: generateId()
            }
          });

          Object.assign(initialData, updates.model);
        }

        // ADR 0002: union bundled fixtures into the model's icons before storing,
        // so the side dock always has the full catalog regardless of what was saved.
        const merged = mergeBundledFixtures(initialData);

        modelActions.set(merged, true);
        modelActions.clearHistory();

        // Reset scroll/zoom for a clean slate on each load, unless the caller
        // explicitly preserves the current viewport (e.g. icon-pack updates).
        // Selection is reset on the same condition — selectedIds carried over
        // from the previous diagram point at items that no longer exist in
        // the new model, leaving the properties panel "open but blank" instead
        // of showing the no-selection placeholder.
        if (!options?.preserveViewport) {
          uiStateActions.setScroll({
            position: CoordsUtils.zero(),
            offset: CoordsUtils.zero()
          });
          uiStateActions.setZoom(INITIAL_UI_STATE.zoom);
          uiStateActions.setSelectedIds([]);
        }

        const activeViewId = uiStateStoreApi.getState().view;
        const targetViewId =
          merged.view ??
          (activeViewId && merged.views.some((v) => v.id === activeViewId)
            ? activeViewId
            : merged.views[0].id);
        const view = getItemByIdOrThrow(merged.views, targetViewId);

        changeView(view.value.id, merged);

        if (merged.fitToView) {
          const rendererEl = uiStateStoreApi.getState().rendererEl;
          const rendererSize = rendererEl?.getBoundingClientRect();

          const { zoom, scroll } = getFitToViewParams(view.value, {
            width: rendererSize?.width ?? 0,
            height: rendererSize?.height ?? 0
          });

          uiStateActions.setScroll({
            position: scroll,
            offset: CoordsUtils.zero()
          });

          uiStateActions.setZoom(zoom);
        }

        // Build the new categories list from the incoming icons.
        // Two regimes:
        //  - First load (existingCategoriesState empty): apply the size guard so
        //    bulk-imported large packs (Material, AWS) don't auto-render thousands
        //    of icons on first paint.
        //  - Incremental load (user toggled a pack, swapped a diagram): user is
        //    actively waiting on the result — auto-expand every new collection,
        //    and mark it freshly-loaded so the header gets a soft pulse. The
        //    PREVIEW_COUNT cap in IconCollection keeps the render bounded.
        const existingCategoriesState = uiStateStoreApi.getState().iconCategoriesState ?? [];
        const existingById = new Map(existingCategoriesState.map((c) => [c.id, c]));
        const isIncrementalLoad = existingCategoriesState.length > 0;

        const freshlyLoadedIds: string[] = [];

        const categoriesState: IconCollectionState[] = categoriseIcons(
          merged.icons
        ).map((collection) => {
          const existing = existingById.get(collection.name ?? '');
          if (existing) {
            return { id: collection.name, isExpanded: existing.isExpanded };
          }
          if (isIncrementalLoad && collection.name) {
            freshlyLoadedIds.push(collection.name);
          }
          return {
            id: collection.name,
            isExpanded: isIncrementalLoad
              ? true
              : collection.icons.length <= LARGE_PACK_THRESHOLD
          };
        });

        uiStateActions.setIconCategoriesState(categoriesState);
        uiStateActions.setFreshlyLoadedCategoryIds(freshlyLoadedIds);

        setIsReady(true);
      } catch (err) {
        console.error('[useInitialDataManager] load threw unexpectedly:', err);
        setIsReady(false);
      }
    },
    [changeView, modelActions, uiStateActions, uiStateStoreApi]
  );

  const clear = useCallback(() => {
    load({ ...INITIAL_DATA, icons: modelIcons, colors: modelColors });
    uiStateActions.resetUiState();
  }, [load, modelIcons, modelColors, uiStateActions]);

  return {
    load,
    clear,
    isReady
  };
};
