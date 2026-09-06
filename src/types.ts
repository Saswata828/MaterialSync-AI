export interface Material {
  id: string;
  PSU_Name: string;
  Material_Code: string;
  Description: string;
  Specification: string;
  Unit_of_Measure: string;
  Category: string;
  HSN_Code: string;
}

export interface ExtractedAttributes {
  category: string;
  materialType?: string;
  size?: string;
  normalizedSize?: number; // legacy size placeholder

  // Category specific fields
  // Steel Pipes
  pipeType?: string;
  diameter?: string;
  schedule?: string;
  // Electrical Motors
  motorType?: string;
  power?: string;
  rpm?: string;
  voltage?: string;
  // Cables
  conductor?: string;
  coreCount?: string;
  crossSection?: string;
  insulation?: string;
  // Bearings
  bearingType?: string;
  modelNumber?: string;
  dimensions?: string;
  // Fasteners
  fastenerType?: string;
  grade?: string;
  // MS Angles
  dimA?: string;
  dimB?: string;
  thickness?: string;
  // Lubricants
  lubricantType?: string;
  viscosityGrade?: string;
  specStandard?: string;
  // Safety Equipment
  equipmentType?: string;

  // Dynamic values for safety and unknown categories
  customAttrs?: Record<string, string>;
}

export interface ComparisonRow {
  attribute: string;
  val1: string;
  val2: string;
  status: 'MATCH' | 'MISMATCH' | 'NONE' | 'CRITICAL_MISMATCH';
}

export interface MatchCandidate {
  id: string;
  material1: Material;
  material2: Material;
  semanticScore: number; // 0 to 100
  materialTypeMatch: boolean;
  specMatch: boolean;
  sizeMatch: boolean;
  confidence: number; // 0 to 100
  status: 'STRONG_MATCH' | 'NEEDS_REVIEW' | 'CRITICAL_MISMATCH';
  matchType: 'CROSS_CPSE' | 'INTERNAL_DUPLICATE';
  reason: string;
  attributes1: ExtractedAttributes;
  attributes2: ExtractedAttributes;

  // Universal comparison signals
  categoryMatch: boolean;
  criticalAttributesTotal: number;
  criticalAttributesMatched: number;
  criticalAttributesMismatched: number;
  optionalAttributesMatched: number;
  optionalAttributesMismatched: number;
  attributeCompleteness: number;
  specificationSimilarity: number;
  explanationList: string[];
  comparisonRows: ComparisonRow[];
}

export interface CommonCodeMapping {
  commonCode: string;
  standardDescription: string;
  category: string;
  linkedMaterials: Array<{
    PSU_Name: string;
    Material_Code: string;
    Description: string;
  }>;
}

export interface AuditLogEntry {
  id: string;
  timestamp: string;
  user: string;
  action: 'APPROVE' | 'REJECT' | 'NEEDS_INFO';
  material1Code: string;
  material2Code: string;
  material1Desc: string;
  material2Desc: string;
  confidence: number;
  finalDecision: string;
  reason?: string;
}

export interface DashboardStats {
  totalMaterials: number;
  participatingCPSEs: number;
  potentialMatchesCount: number;
  approvedCommonCodesCount: number;
  pendingReviewCount: number;
  materialsByCategory: Array<{ name: string; value: number }>;
  materialsByCPSE: Array<{ name: string; value: number }>;
}
