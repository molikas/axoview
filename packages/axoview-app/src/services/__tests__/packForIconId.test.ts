/**
 * An imported diagram JSON names no icon packs, so the pack a node's icon
 * comes from is read off the icon id (shake-out 2026-10-04). Every id in the
 * shipped Material/AWS/GCP/Azure/Kubernetes packs must map to its pack —
 * including each vendor pack's logo, the one id outside its prefix — and no
 * core Isoflow id may map to any pack.
 */
import { packForIconId } from '../iconPackManager';

describe('packForIconId', () => {
  it.each([
    ['material_DoubleArrow', 'material'],
    ['aws-ec2', 'aws'],
    ['gcp-compute-engine', 'gcp'],
    ['azure-virtual-machine', 'azure'],
    ['azureattestation', 'azure'],
    ['k8s-pod', 'kubernetes'],
    // The vendor logos.
    ['_aws_', 'aws'],
    ['_gcp_', 'gcp'],
    ['_azure_', 'azure'],
    ['_k8s_', 'kubernetes']
  ])('%s → %s', (id, pack) => {
    expect(packForIconId(id)).toBe(pack);
  });

  it.each(['block', 'cloud', 'dns', 'user', 'imported-icon-1', ''])(
    '%s (core or user icon) → no pack',
    (id) => {
      expect(packForIconId(id)).toBeNull();
    }
  );
});
