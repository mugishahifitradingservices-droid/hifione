import { supabase } from './supabase';
import { OrganizationRecord } from '../pages/Organizations';

export interface DuplicateMatch {
  organization: OrganizationRecord;
  similarity: number; // 0 to 100
  matchTier: 'EXACT' | 'HIGH' | 'MEDIUM';
  reason: string;
}

export interface DuplicateCluster {
  id: string;
  primary: OrganizationRecord;
  duplicates: OrganizationRecord[];
  highestSimilarity: number;
  reason: string;
  confidence: 'HIGH' | 'MEDIUM';
}

/**
 * Normalizes company name for robust equality and fuzzy matching.
 * Cleans punctuation, lowercases, and maps legal entity synonyms to canonical tokens.
 */
export function normalizeCompanyName(name: string): string {
  if (!name) return '';

  let cleaned = name
    .toLowerCase()
    .trim()
    // Remove diacritics
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

  // Replace common symbols with words or spaces
  cleaned = cleaned
    .replace(/&/g, ' and ')
    .replace(/@/g, ' at ')
    .replace(/[\/\-_+,.:;'"()[\]{}!]/g, ' ');

  // Standardize corporate suffixes and common industry words
  const suffixMap: Record<string, string> = {
    limited: 'ltd',
    'ltd.': 'ltd',
    corporation: 'corp',
    'corp.': 'corp',
    incorporated: 'inc',
    'inc.': 'inc',
    company: 'co',
    'co.': 'co',
    services: 'service',
    enterprises: 'enterprise',
    holdings: 'holding',
    pharmaceuticals: 'pharma',
    pharmacy: 'pharma',
    pharmacies: 'pharma',
    laboratories: 'lab',
    laboratory: 'lab',
    labs: 'lab',
    distributors: 'distrib',
    distributor: 'distrib',
    distribution: 'distrib',
    international: 'intl',
    'intl.': 'intl',
    hospitals: 'hospital',
    clinics: 'clinic',
    technologies: 'tech',
    technology: 'tech',
    trading: 'trade',
    traders: 'trade',
    solutions: 'solution',
    group: 'grp',
  };

  const words = cleaned.split(/\s+/).filter(Boolean);
  const normalizedWords = words.map(w => suffixMap[w] || w);

  return normalizedWords.join(' ');
}

/**
 * Removes stop words (like 'the', 'and', 'co', 'ltd') to get root core name
 */
export function getRootName(normalizedName: string): string {
  const stopWords = new Set(['the', 'and', 'of', 'for', 'in', 'co', 'ltd', 'inc', 'corp', 'llc', 'plc', 'grp', 'service', 'enterprise']);
  return normalizedName
    .split(/\s+/)
    .filter(w => !stopWords.has(w))
    .join(' ');
}

/**
 * Standard Levenshtein Distance
 */
export function levenshteinDistance(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;

  const matrix: number[][] = [];

  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1,     // insertion
          matrix[i - 1][j] + 1      // deletion
        );
      }
    }
  }

  return matrix[b.length][a.length];
}

/**
 * Jaro-Winkler Similarity Algorithm
 */
export function jaroWinklerSimilarity(s1: string, s2: string): number {
  if (s1 === s2) return 1.0;
  if (!s1.length || !s2.length) return 0.0;

  const matchDistance = Math.floor(Math.max(s1.length, s2.length) / 2) - 1;
  const s1Matches = new Array(s1.length).fill(false);
  const s2Matches = new Array(s2.length).fill(false);

  let matches = 0;
  let transpositions = 0;

  for (let i = 0; i < s1.length; i++) {
    const start = Math.max(0, i - matchDistance);
    const end = Math.min(i + matchDistance + 1, s2.length);

    for (let j = start; j < end; j++) {
      if (s2Matches[j]) continue;
      if (s1[i] !== s2[j]) continue;
      s1Matches[i] = true;
      s2Matches[j] = true;
      matches++;
      break;
    }
  }

  if (matches === 0) return 0.0;

  let k = 0;
  for (let i = 0; i < s1.length; i++) {
    if (!s1Matches[i]) continue;
    while (!s2Matches[k]) k++;
    if (s1[i] !== s2[k]) transpositions++;
    k++;
  }

  const jaro = (
    matches / s1.length +
    matches / s2.length +
    (matches - transpositions / 2) / matches
  ) / 3;

  // Winkler prefix scaling (up to 4 chars)
  let prefix = 0;
  for (let i = 0; i < Math.min(4, Math.min(s1.length, s2.length)); i++) {
    if (s1[i] === s2[i]) prefix++;
    else break;
  }

  return jaro + prefix * 0.1 * (1 - jaro);
}

/**
 * Token Set / Jaccard similarity to handle word re-orderings
 */
export function tokenSetSimilarity(s1: string, s2: string): number {
  const set1 = new Set(s1.split(/\s+/).filter(Boolean));
  const set2 = new Set(s2.split(/\s+/).filter(Boolean));

  if (set1.size === 0 && set2.size === 0) return 1.0;
  if (set1.size === 0 || set2.size === 0) return 0.0;

  let intersection = 0;
  set1.forEach(t => {
    if (set2.has(t)) intersection++;
  });

  const union = new Set([...set1, ...set2]).size;
  return intersection / union;
}

/**
 * Calculate Comprehensive Company Similarity Score (0 - 100)
 */
export function calculateCompanySimilarity(
  nameA: string,
  nameB: string,
  extraA?: { phone?: string; email?: string; website?: string },
  extraB?: { phone?: string; email?: string; website?: string }
): { similarity: number; reason: string } {
  const rawA = (nameA || '').trim().toLowerCase();
  const rawB = (nameB || '').trim().toLowerCase();

  if (!rawA || !rawB) return { similarity: 0, reason: '' };

  if (rawA === rawB) {
    return { similarity: 100, reason: 'Exact identical name match' };
  }

  const normA = normalizeCompanyName(nameA);
  const normB = normalizeCompanyName(nameB);

  if (normA === normB) {
    return { similarity: 100, reason: 'Identical after suffix and symbol normalization' };
  }

  const rootA = getRootName(normA);
  const rootB = getRootName(normB);

  if (rootA && rootB && rootA === rootB) {
    return { similarity: 98, reason: 'Identical core business name with variant suffix' };
  }

  // Cross-reference contact channels if provided
  if (extraA && extraB) {
    if (extraA.phone && extraB.phone && extraA.phone.replace(/\D/g, '') === extraB.phone.replace(/\D/g, '') && extraA.phone.length > 5) {
      return { similarity: 95, reason: 'Matching official phone number and similar company name' };
    }
    if (extraA.email && extraB.email && extraA.email.toLowerCase() === extraB.email.toLowerCase()) {
      return { similarity: 96, reason: 'Identical corporate email address and similar name' };
    }
    if (extraA.website && extraB.website) {
      const cleanWebA = extraA.website.replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/$/, '').toLowerCase();
      const cleanWebB = extraB.website.replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/$/, '').toLowerCase();
      if (cleanWebA && cleanWebA === cleanWebB) {
        return { similarity: 97, reason: 'Identical corporate website domain' };
      }
    }
  }

  // Calculate fuzzy metrics
  const jwScore = jaroWinklerSimilarity(normA, normB);
  const tokenScore = tokenSetSimilarity(normA, normB);
  
  const maxLen = Math.max(normA.length, normB.length);
  const levDist = levenshteinDistance(normA, normB);
  const levScore = maxLen > 0 ? Math.max(0, 1 - levDist / maxLen) : 0;

  // Compute composite score
  let composite = (jwScore * 0.45) + (tokenScore * 0.35) + (levScore * 0.20);
  
  // If one name is an exact prefix or substring of another
  if (normA.includes(normB) || normB.includes(normA)) {
    composite = Math.max(composite, 0.85);
  }

  const percent = Math.round(composite * 100);

  let reason = 'High phonetic & string similarity';
  if (tokenScore > 0.85) {
    reason = 'Word transposition / identical words in different order';
  } else if (levDist <= 2 && maxLen > 5) {
    reason = `Minor spelling typo detected (${levDist} character edit${levDist > 1 ? 's' : ''})`;
  } else if (jwScore > 0.90) {
    reason = 'Very close spelling and character sequence match';
  }

  return { similarity: percent, reason };
}

/**
 * Find duplicate candidates for a given target name among existing organizations
 */
export function findDuplicateCandidates(
  targetName: string,
  existingOrgs: OrganizationRecord[],
  excludeOrgId?: string,
  extra?: { phone?: string; email?: string; website?: string }
): DuplicateMatch[] {
  if (!targetName || !targetName.trim()) return [];

  const matches: DuplicateMatch[] = [];

  for (const org of existingOrgs) {
    if (excludeOrgId && org.id === excludeOrgId) continue;

    const { similarity, reason } = calculateCompanySimilarity(
      targetName,
      org.name,
      extra,
      { phone: org.phone, email: org.email, website: org.website }
    );

    if (similarity >= 72) {
      let matchTier: 'EXACT' | 'HIGH' | 'MEDIUM' = 'MEDIUM';
      if (similarity >= 95) matchTier = 'EXACT';
      else if (similarity >= 82) matchTier = 'HIGH';

      matches.push({
        organization: org,
        similarity,
        matchTier,
        reason
      });
    }
  }

  return matches.sort((a, b) => b.similarity - a.similarity);
}

/**
 * Scan entire list of organizations to detect all duplicate clusters in database
 */
export function detectAllDuplicateClusters(organizations: OrganizationRecord[]): DuplicateCluster[] {
  const clusters: DuplicateCluster[] = [];
  const processedIds = new Set<string>();

  // Sort by data completeness so the highest-quality record becomes primary
  const sortedOrgs = [...organizations].sort((a, b) => {
    const scoreA = (a.contacts?.length || 0) * 3 + (a.visits?.length || 0) * 2 + (a.phone ? 1 : 0) + (a.email ? 1 : 0) + (a.address ? 1 : 0);
    const scoreB = (b.contacts?.length || 0) * 3 + (b.visits?.length || 0) * 2 + (b.phone ? 1 : 0) + (b.email ? 1 : 0) + (b.address ? 1 : 0);
    return scoreB - scoreA;
  });

  for (let i = 0; i < sortedOrgs.length; i++) {
    const orgA = sortedOrgs[i];
    if (processedIds.has(orgA.id)) continue;

    const currentDuplicates: OrganizationRecord[] = [];
    let highestSim = 0;
    let clusterReason = '';

    for (let j = i + 1; j < sortedOrgs.length; j++) {
      const orgB = sortedOrgs[j];
      if (processedIds.has(orgB.id)) continue;

      const { similarity, reason } = calculateCompanySimilarity(
        orgA.name,
        orgB.name,
        { phone: orgA.phone, email: orgA.email, website: orgA.website },
        { phone: orgB.phone, email: orgB.email, website: orgB.website }
      );

      if (similarity >= 78) {
        currentDuplicates.push(orgB);
        processedIds.add(orgB.id);
        if (similarity > highestSim) {
          highestSim = similarity;
          clusterReason = reason;
        }
      }
    }

    if (currentDuplicates.length > 0) {
      processedIds.add(orgA.id);
      clusters.push({
        id: `cluster-${orgA.id}`,
        primary: orgA,
        duplicates: currentDuplicates,
        highestSimilarity: highestSim,
        reason: clusterReason,
        confidence: highestSim >= 88 ? 'HIGH' : 'MEDIUM'
      });
    }
  }

  return clusters.sort((a, b) => b.highestSimilarity - a.highestSimilarity);
}

/**
 * Safely merge multiple duplicate organizations into a single master primary organization.
 * Re-assigns contacts, visits, follow-ups, opportunities and updates master organization with missing info.
 */
export async function mergeOrganizations(
  primaryOrg: OrganizationRecord,
  duplicateOrgs: OrganizationRecord[]
): Promise<{ success: boolean; mergedContacts: number; mergedVisits: number; error?: string }> {
  try {
    const duplicateIds = duplicateOrgs.map(d => d.id);
    if (duplicateIds.length === 0) return { success: true, mergedContacts: 0, mergedVisits: 0 };

    let totalContactsMoved = 0;
    let totalVisitsMoved = 0;

    // 1. Reassign contacts
    const { data: movedContacts, error: contactError } = await supabase
      .from('contacts')
      .update({ organization_id: primaryOrg.id })
      .in('organization_id', duplicateIds)
      .select('id');

    if (contactError) {
      console.warn('Contact migration warning:', contactError);
    } else if (movedContacts) {
      totalContactsMoved = movedContacts.length;
    }

    // 2. Reassign planned_visits
    const { data: movedVisits, error: visitError } = await supabase
      .from('planned_visits')
      .update({ organization_id: primaryOrg.id })
      .in('organization_id', duplicateIds)
      .select('id');

    if (visitError) {
      console.warn('Planned visits migration warning:', visitError);
    } else if (movedVisits) {
      totalVisitsMoved = movedVisits.length;
    }

    // 3. Reassign follow_ups
    const { error: followUpError } = await supabase
      .from('follow_ups')
      .update({ organization_id: primaryOrg.id })
      .in('organization_id', duplicateIds);

    if (followUpError) {
      console.warn('Follow up migration warning:', followUpError);
    }

    // 4. Enrich primary organization with non-empty fields from duplicates
    const updatePayload: Partial<OrganizationRecord> = {};
    for (const dup of duplicateOrgs) {
      if (!primaryOrg.phone && dup.phone) updatePayload.phone = dup.phone;
      if (!primaryOrg.email && dup.email) updatePayload.email = dup.email;
      if (!primaryOrg.website && dup.website) updatePayload.website = dup.website;
      if (!primaryOrg.address && dup.address) updatePayload.address = dup.address;
      if (!primaryOrg.city && dup.city) updatePayload.city = dup.city;
      if (!primaryOrg.district && dup.district) updatePayload.district = dup.district;
      if (!primaryOrg.type_of_business && dup.type_of_business) updatePayload.type_of_business = dup.type_of_business;
    }

    if (Object.keys(updatePayload).length > 0) {
      await supabase
        .from('organizations')
        .update(updatePayload)
        .eq('id', primaryOrg.id);
    }

    // 5. Delete duplicate organization records
    const { error: deleteError } = await supabase
      .from('organizations')
      .delete()
      .in('id', duplicateIds);

    if (deleteError) {
      throw deleteError;
    }

    return {
      success: true,
      mergedContacts: totalContactsMoved,
      mergedVisits: totalVisitsMoved
    };
  } catch (err: any) {
    console.error('Merge error:', err);
    return {
      success: false,
      mergedContacts: 0,
      mergedVisits: 0,
      error: err.message || 'Failed to complete merge'
    };
  }
}
