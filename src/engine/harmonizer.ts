import {
  Material,
  ExtractedAttributes,
  MatchCandidate,
  CommonCodeMapping,
  AuditLogEntry,
  DashboardStats,
  ComparisonRow
} from '../types';
import { SEED_MATERIALS } from './seedData';

export const CATEGORY_PREFIXES: Record<string, string> = {
  PIPES: "PIPE",
  VALVES: "VALVE",
  ELECTRICAL: "ELEC",
  FITTINGS: "FIT",
  PUMPS: "PUMP",
  FLANGES: "FLG",
  GASKETS: "GSK",
  INSTRUMENTATION: "INST"
};

export function parseCSV(content: string): any[] {
  const rows: any[] = [];
  let currentField = "";
  let inQuotes = false;
  let currentRow: string[] = [];

  for (let i = 0; i < content.length; i++) {
    const char = content[i];
    const nextChar = content[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        currentField += '"';
        i++; // skip next quote
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      currentRow.push(currentField.trim());
      currentField = "";
    } else if ((char === '\r' || char === '\n') && !inQuotes) {
      if (char === '\r' && nextChar === '\n') {
        i++;
      }
      currentRow.push(currentField.trim());
      rows.push(currentRow);
      currentRow = [];
      currentField = "";
    } else {
      currentField += char;
    }
  }

  if (currentField || currentRow.length > 0) {
    currentRow.push(currentField.trim());
    rows.push(currentRow);
  }

  if (rows.length === 0) return [];

  const headers = rows[0].map((h: string) => h.trim());
  const parsedData: any[] = [];

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (row.length === 1 && row[0] === "") continue;

    const obj: any = {};
    headers.forEach((header: string, index: number) => {
      obj[header] = row[index] || "";
    });

    if (!obj.Material_Code || !obj.Description || !obj.PSU_Name) {
      continue;
    }
    parsedData.push(obj);
  }

  return parsedData;
}

export function normalizeText(text: string): string {
  if (!text) return "";
  let normalized = text.toLowerCase();
  
  normalized = normalized.replace(/\bcs\b/g, "carbon steel");
  normalized = normalized.replace(/\bms\b/g, "mild steel");
  normalized = normalized.replace(/\bss\b/g, "stainless steel");
  
  normalized = normalized.replace(/(\d+(?:\.\d+)?)\s*cm\b/g, (_match, p1) => {
    return `${parseFloat(p1) * 10}mm`;
  });

  normalized = normalized.replace(/(\d+(?:\.\d+)?)\s*(?:inch|\"|in\b)/g, (_match, p1) => {
    return `${parseFloat(p1) * 25}mm`;
  });

  normalized = normalized.replace(/\bschedule\b/g, "sch");
  normalized = normalized.replace(/[^\w\s]/g, " ");
  normalized = normalized.replace(/\s+/g, " ");
  return normalized.trim();
}

export function extractAttributesByCategory(category: string, desc: string, spec: string): ExtractedAttributes {
  const combined = `${desc} ${spec}`.toLowerCase().replace(/,/g, " ");
  
  const attrs: ExtractedAttributes = {
    category,
    materialType: "unknown"
  };

  if (combined.includes("mild steel") || combined.includes("m.s.") || combined.includes("ms ")) {
    attrs.materialType = "Mild Steel";
  } else if (combined.includes("carbon steel") || combined.includes("c.s.") || combined.includes("cs ")) {
    attrs.materialType = "Carbon Steel";
  } else if (combined.includes("stainless steel") || combined.includes("s.s.") || combined.includes("ss ") || combined.includes("ss316") || combined.includes("ss304")) {
    attrs.materialType = "Stainless Steel";
  } else if (combined.includes("galvanized") || combined.includes("g.i.") || combined.includes("gi ")) {
    attrs.materialType = "Galvanized Iron";
  } else if (combined.includes("copper") || combined.includes("cu ")) {
    attrs.materialType = "Copper";
  } else if (combined.includes("aluminium") || combined.includes("al ")) {
    attrs.materialType = "Aluminium";
  } else if (combined.includes("leather")) {
    attrs.materialType = "Leather";
  } else if (combined.includes("polycarbonate")) {
    attrs.materialType = "Polycarbonate";
  }

  const normCat = category.toUpperCase().trim();

  // 1. STEEL PIPES
  if (normCat.includes("PIPE") || normCat.includes("STEEL PIPES")) {
    if (combined.includes("seamless")) attrs.pipeType = "Seamless";
    else if (combined.includes("erw")) attrs.pipeType = "ERW";
    else attrs.pipeType = "Standard";

    const diameterMatch = combined.match(/(\d+(?:\.\d+)?)\s*(?:inch|\"|in\b|mm|nb|dn|cm)/i);
    if (diameterMatch) {
      const rawVal = parseFloat(diameterMatch[1]);
      const matchedText = combined.match(/(\d+(?:\.\d+)?)\s*(inch|\"|in\b|mm|nb|dn|cm)/i)?.[0] || "";
      if (matchedText.includes("inch") || matchedText.includes('"') || matchedText.includes("in")) {
        attrs.diameter = `${rawVal} Inch`;
        attrs.normalizedSize = rawVal * 25.4;
      } else if (matchedText.includes("cm")) {
        attrs.diameter = `${rawVal * 10}mm`;
        attrs.normalizedSize = rawVal * 10;
      } else {
        attrs.diameter = `${rawVal}mm`;
        attrs.normalizedSize = rawVal;
      }
    } else {
      attrs.diameter = "unknown";
      attrs.normalizedSize = 0;
    }

    if (combined.includes("sch 40") || combined.includes("schedule 40")) attrs.schedule = "Sch 40";
    else if (combined.includes("sch 80") || combined.includes("schedule 80")) attrs.schedule = "Sch 80";
    else if (combined.includes("sch 160") || combined.includes("schedule 160")) attrs.schedule = "Sch 160";
    else if (combined.includes("heavy")) attrs.schedule = "Heavy Class";
    else if (combined.includes("medium")) attrs.schedule = "Medium Class";
    else if (combined.includes("light")) attrs.schedule = "Light Class";
    else if (combined.includes("class c")) attrs.schedule = "Class C";
    else if (combined.includes("class b")) attrs.schedule = "Class B";
    else if (combined.includes("class a")) attrs.schedule = "Class A";
    else attrs.schedule = "Standard";
  }
  // 2. ELECTRICAL MOTORS
  else if (normCat.includes("MOTOR") || normCat.includes("ELECTRICAL MOTORS")) {
    if (combined.includes("slip ring")) attrs.motorType = "Slip Ring Motor";
    else if (combined.includes("squirrel cage")) attrs.motorType = "Squirrel Cage Motor";
    else if (combined.includes("induction")) attrs.motorType = "Induction Motor";
    else attrs.motorType = "Electric Motor";

    const powerMatch = combined.match(/(\d+(?:\.\d+)?)\s*(?:hp|horsepower|kw|watts|w)\b/i);
    if (powerMatch) {
      const pUnit = combined.match(/hp|kw|w/i)?.[0].toUpperCase() || "HP";
      attrs.power = `${powerMatch[1]} ${pUnit}`;
    } else {
      attrs.power = "unknown";
    }

    const rpmMatch = combined.match(/(\d+)\s*(?:rpm|revolutions)\b/i);
    attrs.rpm = rpmMatch ? `${rpmMatch[1]} RPM` : "unknown";

    const voltMatch = combined.match(/(\d+)\s*(?:v|volt|volts|kv)\b/i);
    attrs.voltage = voltMatch ? `${voltMatch[1]}V` : "unknown";
  }
  // 3. CABLES
  else if (normCat.includes("CABLE") || normCat.includes("CABLES")) {
    attrs.conductor = combined.includes("copper") ? "Copper" : (combined.includes("aluminium") ? "Aluminium" : "unknown");
    const coreMatch = combined.match(/(\d+(?:\.\d+)?)\s*(?:core|c\b)/i);
    attrs.coreCount = coreMatch ? `${coreMatch[1]} Core` : "1 Core";
    const crossMatch = combined.match(/(\d+(?:\.\d+)?)\s*(?:sq\s*mm|sqmm|sq\.mm|mm2)/i);
    attrs.crossSection = crossMatch ? `${crossMatch[1]} Sq mm` : "unknown";

    if (combined.includes("xlpe")) attrs.insulation = "XLPE";
    else if (combined.includes("pvc")) attrs.insulation = "PVC";
    else attrs.insulation = "Standard";
  }
  // 4. BEARINGS
  else if (normCat.includes("BEARING") || normCat.includes("BEARINGS")) {
    if (combined.includes("spherical roller")) attrs.bearingType = "Spherical Roller Bearing";
    else if (combined.includes("roller")) attrs.bearingType = "Roller Bearing";
    else if (combined.includes("thrust")) attrs.bearingType = "Thrust Bearing";
    else if (combined.includes("ball")) attrs.bearingType = "Ball Bearing";
    else attrs.bearingType = "Bearing";

    const modelMatch = combined.match(/\b([a-z]{1,3}\s*\d{3,5}(?:\s*[a-z0-9]+)?|\d{5}(?:\s*[a-z0-9]+)?)\b/i);
    attrs.modelNumber = modelMatch ? modelMatch[1].toUpperCase().replace(/\s+/g, "") : "unknown";
    const dimMatch = combined.match(/(\d+x\d+x\d+|\d+\s*x\s*\d+)/i);
    attrs.dimensions = dimMatch ? dimMatch[1] : "Standard";
  }
  // 5. FASTENERS
  else if (normCat.includes("FASTENER") || normCat.includes("FASTENERS")) {
    if (combined.includes("allen bolt")) attrs.fastenerType = "Allen Bolt";
    else if (combined.includes("foundation bolt")) attrs.fastenerType = "Foundation Bolt";
    else if (combined.includes("hex bolt")) attrs.fastenerType = "Hex Bolt";
    else if (combined.includes("hex nut")) attrs.fastenerType = "Hex Nut";
    else if (combined.includes("washer")) attrs.fastenerType = "Washer";
    else attrs.fastenerType = "Fastener";

    const sizeMatch = combined.match(/\b(m\d+(?:\s*[x*]\s*\d+)?)\b/i);
    attrs.size = sizeMatch ? sizeMatch[1].toUpperCase().replace(/\s+/g, "") : "unknown";
    const gradeMatch = combined.match(/(grade\s*\d+\.\d+|grade\s*\d+|gr\s*\d+\.\d+|gr\s*\d+)/i);
    attrs.grade = gradeMatch ? gradeMatch[1].toUpperCase() : "Standard";
  }
  // 6. MS ANGLES
  else if (normCat.includes("ANGLE") || normCat.includes("MS ANGLES")) {
    attrs.materialType = "Mild Steel";
    const dimMatch = combined.match(/(\d+)\s*[x*]\s*(\d+)\s*[x*]\s*(\d+(?:\.\d+)?)/i);
    if (dimMatch) {
      attrs.dimA = `${dimMatch[1]}mm`;
      attrs.dimB = `${dimMatch[2]}mm`;
      attrs.thickness = `${dimMatch[3]}mm`;
      attrs.size = `${dimMatch[1]}x${dimMatch[2]}mm`;
    } else {
      attrs.dimA = "unknown";
      attrs.dimB = "unknown";
      attrs.thickness = "unknown";
      attrs.size = "unknown";
    }
  }
  // 7. LUBRICANTS
  else if (normCat.includes("LUBRICANT") || normCat.includes("LUBRICANTS")) {
    if (combined.includes("hydraulic oil")) attrs.lubricantType = "Hydraulic Oil";
    else if (combined.includes("gear oil")) attrs.lubricantType = "Gear Oil";
    else if (combined.includes("engine oil")) attrs.lubricantType = "Engine Oil";
    else if (combined.includes("grease")) attrs.lubricantType = "Grease";
    else attrs.lubricantType = "Lubricant";

    const viscosityMatch = combined.match(/(iso\s*vg\s*\d+|ep\s*\d+|sae\s*\d+[w]?\d+|nlgi\s*\d+)/i);
    attrs.viscosityGrade = viscosityMatch ? viscosityMatch[1].toUpperCase().replace(/\s+/g, " ") : "unknown";
    const stdMatch = combined.match(/(ci-4|ch-4|ap[i-z]|is\s*\d+)/i);
    attrs.specStandard = stdMatch ? stdMatch[1].toUpperCase() : "Standard";
  }
  // 8. SAFETY EQUIPMENT
  else if (normCat.includes("SAFETY") || normCat.includes("SAFETY EQUIPMENT")) {
    if (combined.includes("ear muff")) attrs.equipmentType = "Ear Muff";
    else if (combined.includes("goggles")) attrs.equipmentType = "Safety Goggles";
    else if (combined.includes("helmet")) attrs.equipmentType = "Safety Helmet";
    else if (combined.includes("shoes")) attrs.equipmentType = "Safety Shoes";
    else if (combined.includes("harness")) attrs.equipmentType = "Safety Harness";
    else if (combined.includes("gloves")) attrs.equipmentType = "Safety Gloves";
    else attrs.equipmentType = "Safety Accessory";

    const custom: Record<string, string> = {};
    const snrMatch = combined.match(/(snr\s*\d+\s*db|\d+\s*db)/i);
    if (snrMatch) custom["Noise Rating"] = snrMatch[1].toUpperCase();
    const stdMatch = combined.match(/(is\s*\d+)/i);
    if (stdMatch) custom["Safety Standard"] = stdMatch[1].toUpperCase();
    const sizeMatch = combined.match(/(size\s*\d+)/i);
    if (sizeMatch) custom["Size"] = sizeMatch[1].toUpperCase();
    const lensMatch = combined.match(/(clear\b|tinted\b|polycarbonate\b)/i);
    if (lensMatch) custom["Lens / Material"] = lensMatch[1].toUpperCase();
    attrs.customAttrs = custom;
  }
  // 9. DYNAMIC MODE FOR UNKNOWN CATEGORIES
  else {
    const custom: Record<string, string> = {};
    const words = desc.trim().split(/\s+/);
    attrs.equipmentType = words[0] || "Component";

    const pairs = spec.split(/[;,]/);
    pairs.forEach(p => {
      const parts = p.split(":");
      if (parts.length === 2) {
        const key = parts[0].trim().toUpperCase();
        const val = parts[1].trim();
        if (key && val) {
          custom[key] = val;
        }
      }
    });

    attrs.customAttrs = custom;
  }

  return attrs;
}

export function compareCandidateAttributes(cat: string, a1: ExtractedAttributes, a2: ExtractedAttributes): {
  criticalTotal: number;
  criticalMatched: number;
  criticalMismatched: number;
  optionalMatched: number;
  optionalMismatched: number;
  isCriticalConflict: boolean;
  conflictReason: string;
  rows: ComparisonRow[];
} {
  const normCat = cat.toUpperCase().trim();
  const rows: ComparisonRow[] = [];
  let isCriticalConflict = false;
  let conflictReason = "";

  let criticalTotal = 0;
  let criticalMatched = 0;
  let criticalMismatched = 0;
  let optionalMatched = 0;
  let optionalMismatched = 0;

  function addRow(attr: string, v1: string, v2: string, isCritical: boolean, isEq: boolean) {
    let status: 'MATCH' | 'MISMATCH' | 'NONE' | 'CRITICAL_MISMATCH' = 'NONE';
    if (v1 && v2 && v1 !== "unknown" && v2 !== "unknown") {
      if (isCritical) {
        criticalTotal++;
        if (isEq) {
          criticalMatched++;
          status = 'MATCH';
        } else {
          criticalMismatched++;
          status = 'CRITICAL_MISMATCH';
          isCriticalConflict = true;
          conflictReason = `Critical Specification Mismatch: ${attr} difference (${v1} vs ${v2})`;
        }
      } else {
        if (isEq) {
          optionalMatched++;
          status = 'MATCH';
        } else {
          optionalMismatched++;
          status = 'MISMATCH';
        }
      }
    }
    rows.push({
      attribute: attr,
      val1: v1 || "Not specified",
      val2: v2 || "Not specified",
      status
    });
  }

  if (normCat.includes("PIPE") || normCat.includes("STEEL PIPES")) {
    addRow("Diameter / Size", a1.diameter || "unknown", a2.diameter || "unknown", true, a1.diameter === a2.diameter);
    addRow("Schedule / Class", a1.schedule || "unknown", a2.schedule || "unknown", true, a1.schedule === a2.schedule);
    addRow("Material Type", a1.materialType || "unknown", a2.materialType || "unknown", false, a1.materialType === a2.materialType);
    addRow("Pipe Type", a1.pipeType || "unknown", a2.pipeType || "unknown", false, a1.pipeType === a2.pipeType);
  } else if (normCat.includes("MOTOR") || normCat.includes("ELECTRICAL MOTORS")) {
    addRow("Power Rating", a1.power || "unknown", a2.power || "unknown", true, a1.power === a2.power);
    addRow("Voltage", a1.voltage || "unknown", a2.voltage || "unknown", true, a1.voltage === a2.voltage);
    addRow("RPM", a1.rpm || "unknown", a2.rpm || "unknown", false, a1.rpm === a2.rpm);
    addRow("Motor Type", a1.motorType || "unknown", a2.motorType || "unknown", false, a1.motorType === a2.motorType);
  } else if (normCat.includes("CABLE") || normCat.includes("CABLES")) {
    addRow("Conductor Material", a1.conductor || "unknown", a2.conductor || "unknown", true, a1.conductor === a2.conductor);
    addRow("Cross Section Area", a1.crossSection || "unknown", a2.crossSection || "unknown", true, a1.crossSection === a2.crossSection);
    addRow("Core Count", a1.coreCount || "unknown", a2.coreCount || "unknown", true, a1.coreCount === a2.coreCount);
    addRow("Insulation", a1.insulation || "unknown", a2.insulation || "unknown", false, a1.insulation === a2.insulation);
  } else if (normCat.includes("BEARING") || normCat.includes("BEARINGS")) {
    addRow("Model Number", a1.modelNumber || "unknown", a2.modelNumber || "unknown", true, a1.modelNumber === a2.modelNumber);
    addRow("Bearing Type", a1.bearingType || "unknown", a2.bearingType || "unknown", false, a1.bearingType === a2.bearingType);
    addRow("Dimensions", a1.dimensions || "unknown", a2.dimensions || "unknown", false, a1.dimensions === a2.dimensions);
  } else if (normCat.includes("FASTENER") || normCat.includes("FASTENERS")) {
    addRow("Size / Dimension", a1.size || "unknown", a2.size || "unknown", true, a1.size === a2.size);
    addRow("Tensile Grade", a1.grade || "unknown", a2.grade || "unknown", true, a1.grade === a2.grade);
    addRow("Fastener Type", a1.fastenerType || "unknown", a2.fastenerType || "unknown", false, a1.fastenerType === a2.fastenerType);
    addRow("Material Type", a1.materialType || "unknown", a2.materialType || "unknown", false, a1.materialType === a2.materialType);
  } else if (normCat.includes("ANGLE") || normCat.includes("MS ANGLES")) {
    addRow("Dimensions (Size)", a1.size || "unknown", a2.size || "unknown", true, a1.size === a2.size);
    addRow("Thickness", a1.thickness || "unknown", a2.thickness || "unknown", true, a1.thickness === a2.thickness);
    addRow("Material Type", a1.materialType || "unknown", a2.materialType || "unknown", false, a1.materialType === a2.materialType);
  } else if (normCat.includes("LUBRICANT") || normCat.includes("LUBRICANTS")) {
    addRow("Viscosity Grade", a1.viscosityGrade || "unknown", a2.viscosityGrade || "unknown", true, a1.viscosityGrade === a2.viscosityGrade);
    addRow("Lubricant Type", a1.lubricantType || "unknown", a2.lubricantType || "unknown", false, a1.lubricantType === a2.lubricantType);
    addRow("Standard Spec", a1.specStandard || "unknown", a2.specStandard || "unknown", false, a1.specStandard === a2.specStandard);
  } else if (normCat.includes("SAFETY") || normCat.includes("SAFETY EQUIPMENT")) {
    addRow("Equipment Type", a1.equipmentType || "unknown", a2.equipmentType || "unknown", true, a1.equipmentType === a2.equipmentType);
    const allKeys = new Set([...Object.keys(a1.customAttrs || {}), ...Object.keys(a2.customAttrs || {})]);
    allKeys.forEach(key => {
      const v1 = a1.customAttrs?.[key] || "unknown";
      const v2 = a2.customAttrs?.[key] || "unknown";
      addRow(key, v1, v2, false, v1 === v2);
    });
  } else {
    addRow("Product Type", a1.equipmentType || "unknown", a2.equipmentType || "unknown", true, a1.equipmentType === a2.equipmentType);
    const allKeys = new Set([...Object.keys(a1.customAttrs || {}), ...Object.keys(a2.customAttrs || {})]);
    allKeys.forEach(key => {
      const v1 = a1.customAttrs?.[key] || "unknown";
      const v2 = a2.customAttrs?.[key] || "unknown";
      addRow(key, v1, v2, false, v1 === v2);
    });
  }

  return {
    criticalTotal,
    criticalMatched,
    criticalMismatched,
    optionalMatched,
    optionalMismatched,
    isCriticalConflict,
    conflictReason,
    rows
  };
}

export class TfIdfEngine {
  private documentTokens: string[][] = [];
  private idfs: Record<string, number> = {};
  private vocab: string[] = [];

  constructor(documents: string[]) {
    const stopWords = new Set(["and", "the", "with", "for", "of", "a", "an", "to", "in", "by", "on", "at", "it", "is"]);
    
    this.documentTokens = documents.map(doc => {
      return normalizeText(doc)
        .split(/\s+/)
        .filter(t => t.length > 1 && !stopWords.has(t));
    });

    const docCounts: Record<string, number> = {};
    const totalDocs = documents.length;

    this.documentTokens.forEach(tokens => {
      const uniqueTokensInDoc = new Set(tokens);
      uniqueTokensInDoc.forEach(token => {
        docCounts[token] = (docCounts[token] || 0) + 1;
      });
    });

    this.vocab = Object.keys(docCounts);
    this.vocab.forEach(token => {
      this.idfs[token] = Math.log(1 + totalDocs / (1 + docCounts[token]));
    });
  }

  public vectorize(text: string): Record<string, number> {
    const tokens = normalizeText(text)
      .split(/\s+/)
      .filter(t => t.length > 1);
    
    const termFreqs: Record<string, number> = {};
    tokens.forEach(t => {
      termFreqs[t] = (termFreqs[t] || 0) + 1;
    });

    const vector: Record<string, number> = {};
    const docLength = tokens.length || 1;

    Object.keys(termFreqs).forEach(token => {
      if (this.idfs[token]) {
        const tf = termFreqs[token] / docLength;
        vector[token] = tf * this.idfs[token];
      }
    });

    return vector;
  }

  public cosineSimilarity(v1: Record<string, number>, v2: Record<string, number>): number {
    let dotProduct = 0;
    let mag1 = 0;
    let mag2 = 0;

    Object.keys(v1).forEach(key => {
      mag1 += v1[key] * v1[key];
      if (v2[key]) {
        dotProduct += v1[key] * v2[key];
      }
    });

    Object.keys(v2).forEach(key => {
      mag2 += v2[key] * v2[key];
    });

    if (mag1 === 0 || mag2 === 0) return 0;
    return dotProduct / (Math.sqrt(mag1) * Math.sqrt(mag2));
  }
}

export function runMatchingPipeline(allMaterials: Material[]): MatchCandidate[] {
  const corpus = allMaterials.map(m => `${m.Description} ${m.Specification}`);
  const tfidf = new TfIdfEngine(corpus);
  const newMatches: MatchCandidate[] = [];

  const categoriesMap: Record<string, Material[]> = {};
  allMaterials.forEach(m => {
    const cat = m.Category || "UNCATEGORIZED";
    if (!categoriesMap[cat]) {
      categoriesMap[cat] = [];
    }
    categoriesMap[cat].push(m);
  });

  const vectors: Record<string, Record<string, number>> = {};
  allMaterials.forEach(m => {
    vectors[m.id] = tfidf.vectorize(`${m.Description} ${m.Specification}`);
  });

  Object.keys(categoriesMap).forEach(cat => {
    const list = categoriesMap[cat];
    const n = list.length;
    const isKnownCategory = ["CABLES", "MS ANGLES", "BEARINGS", "ELECTRICAL MOTORS", "FASTENERS", "STEEL PIPES", "LUBRICANTS", "SAFETY EQUIPMENT", "PIPES", "VALVES", "ELECTRICAL", "FITTINGS", "PUMPS", "FLANGES", "GASKETS", "INSTRUMENTATION"].includes(cat.toUpperCase().trim());

    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        const m1 = list[i];
        const m2 = list[j];

        const vec1 = vectors[m1.id];
        const vec2 = vectors[m2.id];

        const semanticSim = tfidf.cosineSimilarity(vec1, vec2);
        const semanticScore = Math.round(semanticSim * 100);

        if (semanticScore < 50) continue;

        const attrs1 = extractAttributesByCategory(cat, m1.Description, m1.Specification);
        const attrs2 = extractAttributesByCategory(cat, m2.Description, m2.Specification);
        const comp = compareCandidateAttributes(cat, attrs1, attrs2);

        let confidence = 0;
        confidence += (semanticScore * 0.40);

        if (comp.criticalTotal > 0) {
          const ratio = comp.criticalMatched / comp.criticalTotal;
          confidence += (ratio * 45);
        } else {
          confidence += 22.5;
        }

        const totalOptional = comp.optionalMatched + comp.optionalMismatched;
        if (totalOptional > 0) {
          confidence += ((comp.optionalMatched / totalOptional) * 15);
        } else {
          confidence += 7.5;
        }

        confidence = Math.round(confidence);

        const explanationList: string[] = [];
        explanationList.push(`✓ Category Mapped: ${cat}`);
        explanationList.push(`✓ Description Semantic Similarity: ${semanticScore}%`);

        if (comp.criticalTotal > 0) {
          explanationList.push(`✓ Critical Technical Attributes: ${comp.criticalMatched}/${comp.criticalTotal} matched.`);
        }
        comp.rows.forEach(row => {
          if (row.status === 'MATCH' && row.val1 !== "unknown" && row.val1 !== "Not specified") {
            explanationList.push(`✓ ${row.attribute}: ${row.val1} (Match)`);
          }
        });

        let status: 'STRONG_MATCH' | 'NEEDS_REVIEW' | 'CRITICAL_MISMATCH' = 'NEEDS_REVIEW';
        let reason = "High semantic and physical attribute similarity.";

        if (comp.isCriticalConflict) {
          status = 'CRITICAL_MISMATCH';
          reason = comp.conflictReason;
          confidence = Math.min(confidence, 45);
          
          explanationList.push(`✗ Critical Spec Conflict Detected`);
          comp.rows.forEach(row => {
            if (row.status === 'CRITICAL_MISMATCH') {
              explanationList.push(`✗ ${row.attribute} Mismatch: ${row.val1} vs ${row.val2}`);
            }
          });
        } else {
          if (!isKnownCategory) {
            status = 'NEEDS_REVIEW';
            reason = `Unknown Category "${cat}". Switched to Dynamic Attribute Extraction Mode. Requires human review.`;
            confidence = Math.min(confidence, 79);
            explanationList.push(`! Dynamic Extraction Fallback: Category not in standard registry`);
          } else {
            if (confidence >= 85) {
              status = 'STRONG_MATCH';
              reason = "Equivalent material matching across key attributes.";
            } else if (confidence >= 65) {
              status = 'NEEDS_REVIEW';
              reason = "Partial attribute match. Human verification required.";
            } else {
              continue;
            }
          }
        }

        const matchType = m1.PSU_Name === m2.PSU_Name ? 'INTERNAL_DUPLICATE' : 'CROSS_CPSE';
        if (matchType === 'INTERNAL_DUPLICATE' && status !== 'CRITICAL_MISMATCH') {
          reason = "[Possible Internal Duplicate] Same CPSE. " + reason;
          explanationList.push(`! Duplicate check flagged: Both materials belong to ${m1.PSU_Name}`);
        }

        newMatches.push({
          id: `${m1.Material_Code}_${m2.Material_Code}`,
          material1: m1,
          material2: m2,
          semanticScore,
          materialTypeMatch: (attrs1.materialType === attrs2.materialType && attrs1.materialType !== "unknown"),
          specMatch: (comp.criticalMismatched === 0),
          sizeMatch: (attrs1.normalizedSize !== undefined && attrs1.normalizedSize > 0 && attrs1.normalizedSize === attrs2.normalizedSize),
          confidence,
          status,
          matchType,
          reason,
          attributes1: attrs1,
          attributes2: attrs2,
          categoryMatch: true,
          criticalAttributesTotal: comp.criticalTotal,
          criticalAttributesMatched: comp.criticalMatched,
          criticalAttributesMismatched: comp.criticalMismatched,
          optionalAttributesMatched: comp.optionalMatched,
          optionalAttributesMismatched: comp.optionalMismatched,
          attributeCompleteness: Math.round(((comp.criticalMatched + comp.optionalMatched) / (comp.rows.length || 1)) * 100),
          specificationSimilarity: Math.round(((comp.criticalMatched + comp.optionalMatched) / (comp.rows.length || 1)) * 100),
          explanationList,
          comparisonRows: comp.rows
        });
      }
    }
  });

  newMatches.sort((a, b) => b.confidence - a.confidence);
  return newMatches;
}

export function synthesizeFullDataset(baseMaterials: Material[]): Material[] {
  const result = [...baseMaterials];
  const psus = ["ONGC", "IOCL", "NTPC", "GAIL", "BHEL", "BPCL"];
  const categories = ["PIPES", "VALVES", "ELECTRICAL", "FITTINGS", "PUMPS", "FLANGES", "GASKETS", "INSTRUMENTATION"];
  const uoms: Record<string, string> = {
    PIPES: "MTRS",
    VALVES: "NOS",
    ELECTRICAL: "MTRS",
    FITTINGS: "NOS",
    PUMPS: "NOS",
    FLANGES: "NOS",
    GASKETS: "NOS",
    INSTRUMENTATION: "NOS"
  };

  const sizes = ["2 Inch", "4 Inch", "6 Inch", "8 Inch", "50mm", "100mm", "150mm", "200mm"];
  const subMaterials: Record<string, string[]> = {
    PIPES: ["Carbon Steel Seamless", "Mild Steel Seamless", "SS304 Welded", "SS316 Seamless"],
    VALVES: ["Gate Valve", "Ball Valve", "Globe Valve", "Check Valve"],
    ELECTRICAL: ["Copper Armored Cable 3C x 16 Sqmm", "Aluminium Power Cable 4C x 120 Sqmm", "LED Flood Light 100W", "Industrial Switchgear 63A"],
    FITTINGS: ["90 Deg Elbow", "Equal Tee", "Concentric Reducer", "Butt Weld Cap"],
    PUMPS: ["Centrifugal Water Pump 50HP", "Submersible Sewage Pump 10HP", "Chemical Dosing Pump", "Multistage High Pressure Pump"],
    FLANGES: ["Weld Neck Flange", "Slip On Flange", "Blind Flange", "Socket Weld Flange"],
    GASKETS: ["Spiral Wound Gasket SS316", "Compressed Asbestos Fiber Gasket", "PTFE Envelope Gasket", "Neoprene Rubber Gasket"],
    INSTRUMENTATION: ["Pressure Gauge 0-10 Bar", "Temperature Transmitter PT100", "Digital Flow Meter", "Level Switch Float Type"]
  };

  const pressClasses = ["Class 150", "Class 300", "Class 800", "Sch 40", "Sch 80"];
  const hsnPrefixes: Record<string, string> = {
    PIPES: "7304",
    VALVES: "8481",
    ELECTRICAL: "8544",
    FITTINGS: "7307",
    PUMPS: "8413",
    FLANGES: "7307",
    GASKETS: "8484",
    INSTRUMENTATION: "9026"
  };

  let counter = baseMaterials.length;
  const targetCount = 1200;

  // Predictable pseudo-random generator for consistent data across server & client
  let seed = 42;
  function pseudoRandom() {
    seed = (seed * 9301 + 49297) % 233280;
    return seed / 233280;
  }

  while (result.length < targetCount) {
    const psu = psus[Math.floor(pseudoRandom() * psus.length)];
    const cat = categories[Math.floor(pseudoRandom() * categories.length)];
    const sub = subMaterials[cat][Math.floor(pseudoRandom() * subMaterials[cat].length)];
    const size = sizes[Math.floor(pseudoRandom() * sizes.length)];
    const press = pressClasses[Math.floor(pseudoRandom() * pressClasses.length)];
    const uom = uoms[cat];

    const hsn = hsnPrefixes[cat] + Math.floor(1000 + pseudoRandom() * 9000).toString();
    const code = `${psu}-${CATEGORY_PREFIXES[cat] || "MAT"}-${100000 + counter}`;
    
    let description = "";
    let specification = "";

    if (cat === "PIPES" || cat === "FITTINGS" || cat === "VALVES" || cat === "FLANGES" || cat === "GASKETS") {
      description = `${sub} ${size} ${press}`;
      specification = `${sub}, Size: ${size}, Rating: ${press}, Standard: ASME B16.9`;
    } else {
      description = `${sub}`;
      specification = `${sub}, Type: Industrial, Standard: IS/IEC Compliant`;
    }

    result.push({
      id: code,
      PSU_Name: psu,
      Material_Code: code,
      Description: description,
      Specification: specification,
      Unit_of_Measure: uom,
      Category: cat,
      HSN_Code: hsn
    });

    counter++;
  }

  return result;
}

export interface EngineState {
  materials: Material[];
  matches: MatchCandidate[];
  mappings: CommonCodeMapping[];
  auditLogs: AuditLogEntry[];
}

export class HarmonizationEngine {
  private materials: Material[] = [];
  private matches: MatchCandidate[] = [];
  private mappings: CommonCodeMapping[] = [];
  private auditLogs: AuditLogEntry[] = [];
  private isInitialized = false;

  constructor(initialState?: Partial<EngineState>) {
    if (initialState) {
      this.initFromState(initialState);
    }
  }

  public initialize(baseMaterials: Material[] = SEED_MATERIALS) {
    if (this.isInitialized) return;
    this.materials = synthesizeFullDataset(baseMaterials);
    this.matches = runMatchingPipeline(this.materials);
    this.mappings = [];
    this.auditLogs = [];

    // Prepopulate initial mappings
    const strongCandidates = this.matches.filter(m => m.status === 'STRONG_MATCH').slice(0, 5);
    strongCandidates.forEach((candidate, idx) => {
      const commonCode = `NMC-${CATEGORY_PREFIXES[candidate.material1.Category] || "GEN"}-${String(200 + idx).padStart(6, '0')}`;
      this.mappings.push({
        commonCode,
        standardDescription: candidate.material1.Description,
        category: candidate.material1.Category,
        linkedMaterials: [
          {
            PSU_Name: candidate.material1.PSU_Name,
            Material_Code: candidate.material1.Material_Code,
            Description: candidate.material1.Description
          },
          {
            PSU_Name: candidate.material2.PSU_Name,
            Material_Code: candidate.material2.Material_Code,
            Description: candidate.material2.Description
          }
        ]
      });
    });

    this.isInitialized = true;
  }

  public initFromState(state: Partial<EngineState>) {
    if (state.materials && state.materials.length > 0) {
      this.materials = state.materials;
      this.matches = state.matches || runMatchingPipeline(this.materials);
      this.mappings = state.mappings || [];
      this.auditLogs = state.auditLogs || [];
      this.isInitialized = true;
    } else {
      this.initialize();
    }
  }

  public getState(): EngineState {
    if (!this.isInitialized) this.initialize();
    return {
      materials: this.materials,
      matches: this.matches,
      mappings: this.mappings,
      auditLogs: this.auditLogs
    };
  }

  public getMaterials(): Material[] {
    if (!this.isInitialized) this.initialize();
    return this.materials;
  }

  public getMatches(): MatchCandidate[] {
    if (!this.isInitialized) this.initialize();
    return this.matches;
  }

  public getMappings(): CommonCodeMapping[] {
    if (!this.isInitialized) this.initialize();
    return this.mappings;
  }

  public getAuditLogs(): AuditLogEntry[] {
    if (!this.isInitialized) this.initialize();
    return this.auditLogs;
  }

  public getStats(): DashboardStats {
    if (!this.isInitialized) this.initialize();

    const participatingCPSEs = new Set(this.materials.map(m => m.PSU_Name)).size;
    const pendingReviewCount = this.matches.filter(m => m.status === 'NEEDS_REVIEW').length;
    const potentialMatchesCount = this.matches.filter(m => m.status === 'STRONG_MATCH' || m.status === 'NEEDS_REVIEW').length;

    const categoryCounts: Record<string, number> = {};
    this.materials.forEach(m => {
      categoryCounts[m.Category] = (categoryCounts[m.Category] || 0) + 1;
    });
    const materialsByCategory = Object.keys(categoryCounts).map(key => ({
      name: key,
      value: categoryCounts[key]
    }));

    const psuCounts: Record<string, number> = {};
    this.materials.forEach(m => {
      psuCounts[m.PSU_Name] = (psuCounts[m.PSU_Name] || 0) + 1;
    });
    const materialsByCPSE = Object.keys(psuCounts).map(key => ({
      name: key,
      value: psuCounts[key]
    }));

    return {
      totalMaterials: this.materials.length,
      participatingCPSEs,
      potentialMatchesCount,
      approvedCommonCodesCount: this.mappings.length,
      pendingReviewCount,
      materialsByCategory,
      materialsByCPSE
    };
  }

  public reviewDecision(matchId: string, action: 'APPROVE' | 'REJECT' | 'NEEDS_INFO', reason?: string, user?: string): { success: boolean; commonCode?: string | null; error?: string } {
    if (!this.isInitialized) this.initialize();

    const matchIdx = this.matches.findIndex(m => m.id === matchId);
    if (matchIdx === -1) {
      return { success: false, error: "Match pair not found" };
    }

    const candidate = this.matches[matchIdx];
    const timestamp = new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" });
    const finalDecision = action === "APPROVE" 
      ? "Common Code Assigned" 
      : action === "REJECT" 
        ? "Rejected Match" 
        : "Hold - Requested More Info";

    const logEntry: AuditLogEntry = {
      id: `LOG-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      timestamp,
      user: user || "Ministry Administrator",
      action,
      material1Code: candidate.material1.Material_Code,
      material2Code: candidate.material2.Material_Code,
      material1Desc: candidate.material1.Description,
      material2Desc: candidate.material2.Description,
      confidence: candidate.confidence,
      finalDecision,
      reason: reason || ""
    };

    this.auditLogs.unshift(logEntry);

    if (action === "APPROVE") {
      const category = candidate.material1.Category;
      const prefix = CATEGORY_PREFIXES[category] || "GEN";
      const number = String(100000 + this.mappings.length + 1).slice(1);
      const commonCode = `NMC-${prefix}-${number}`;

      const mappingIndex = this.mappings.findIndex(m => 
        m.linkedMaterials.some(lm => lm.Material_Code === candidate.material1.Material_Code || lm.Material_Code === candidate.material2.Material_Code)
      );

      if (mappingIndex !== -1) {
        const currentMapping = this.mappings[mappingIndex];
        const alreadyHasM1 = currentMapping.linkedMaterials.some(lm => lm.Material_Code === candidate.material1.Material_Code);
        const alreadyHasM2 = currentMapping.linkedMaterials.some(lm => lm.Material_Code === candidate.material2.Material_Code);
        
        if (!alreadyHasM1) {
          currentMapping.linkedMaterials.push({
            PSU_Name: candidate.material1.PSU_Name,
            Material_Code: candidate.material1.Material_Code,
            Description: candidate.material1.Description
          });
        }
        if (!alreadyHasM2) {
          currentMapping.linkedMaterials.push({
            PSU_Name: candidate.material2.PSU_Name,
            Material_Code: candidate.material2.Material_Code,
            Description: candidate.material2.Description
          });
        }
        logEntry.finalDecision = `Linked to existing ${currentMapping.commonCode}`;
      } else {
        this.mappings.push({
          commonCode,
          standardDescription: candidate.material1.Description,
          category,
          linkedMaterials: [
            {
              PSU_Name: candidate.material1.PSU_Name,
              Material_Code: candidate.material1.Material_Code,
              Description: candidate.material1.Description
            },
            {
              PSU_Name: candidate.material2.PSU_Name,
              Material_Code: candidate.material2.Material_Code,
              Description: candidate.material2.Description
            }
          ]
        });
      }
    }

    this.matches.splice(matchIdx, 1);
    return { success: true, commonCode: action === "APPROVE" ? logEntry.finalDecision : null };
  }

  public uploadCsv(csvContent: string): { success: boolean; addedCount?: number; totalMaterials?: number; error?: string } {
    if (!this.isInitialized) this.initialize();
    if (!csvContent) {
      return { success: false, error: "No CSV content provided." };
    }

    try {
      const parsed = parseCSV(csvContent);
      if (parsed.length === 0) {
        return { success: false, error: "CSV parsed empty or missing headers/data." };
      }

      const uploadedMaterials: Material[] = parsed.map((row: any) => ({
        id: row.Material_Code,
        PSU_Name: row.PSU_Name,
        Material_Code: row.Material_Code,
        Description: row.Description,
        Specification: row.Specification || "",
        Unit_of_Measure: row.Unit_of_Measure || "NOS",
        Category: row.Category || "UNCATEGORIZED",
        HSN_Code: row.HSN_Code || ""
      }));

      let addedCount = 0;
      uploadedMaterials.forEach(um => {
        const exists = this.materials.some(m => m.Material_Code === um.Material_Code && m.PSU_Name === um.PSU_Name);
        if (!exists) {
          this.materials.unshift(um);
          addedCount++;
        }
      });

      this.matches = runMatchingPipeline(this.materials);
      return { success: true, addedCount, totalMaterials: this.materials.length };
    } catch (err: any) {
      return { success: false, error: `Failed to load CSV: ${err.message}` };
    }
  }

  public bulkApprove(minConfidence: number = 85): { success: boolean; approvedCount: number } {
    if (!this.isInitialized) this.initialize();

    const candidatesToApprove = this.matches.filter(m => m.confidence >= minConfidence);
    let approvedCount = 0;
    const processQueue = [...candidatesToApprove];

    for (const candidate of processQueue) {
      const matchIdx = this.matches.findIndex(m => m.id === candidate.id);
      if (matchIdx === -1) continue;

      const commonCodePrefix = CATEGORY_PREFIXES[candidate.material1.Category] || "GEN";
      const number = String(100000 + this.mappings.length + 1).slice(1);
      const commonCode = `NMC-${commonCodePrefix}-${number}`;

      this.mappings.push({
        commonCode,
        standardDescription: candidate.material1.Description,
        category: candidate.material1.Category,
        linkedMaterials: [
          { PSU_Name: candidate.material1.PSU_Name, Material_Code: candidate.material1.Material_Code, Description: candidate.material1.Description },
          { PSU_Name: candidate.material2.PSU_Name, Material_Code: candidate.material2.Material_Code, Description: candidate.material2.Description }
        ]
      });

      this.auditLogs.unshift({
        id: `LOG-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        timestamp: new Date().toISOString().replace("T", " ").substring(0, 19),
        user: "Ministry Admin (Bulk Automated)",
        action: "APPROVE",
        material1Code: candidate.material1.Material_Code,
        material2Code: candidate.material2.Material_Code,
        material1Desc: candidate.material1.Description,
        material2Desc: candidate.material2.Description,
        confidence: candidate.confidence,
        finalDecision: commonCode,
        reason: `Automated approval by Admin Rule Threshold (>= ${minConfidence}%)`
      });

      this.matches.splice(matchIdx, 1);
      approvedCount++;
    }

    return { success: true, approvedCount };
  }

  public reset(baseMaterials: Material[] = SEED_MATERIALS) {
    this.isInitialized = false;
    this.initialize(baseMaterials);
  }
}

// Global shared engine instance
export const globalEngine = new HarmonizationEngine();
