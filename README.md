# MaterialSync AI – National Material Harmonization Platform

MaterialSync AI is an AI-driven standardization and mapping layer designed to harmonize material codes across Central Public Sector Enterprises (CPSEs). It does not replace any organization's existing SAP/ERP system; instead, it establishes a centralized mapping layer (National Material Code - NMC) on top of them.

---

## 🚀 Quick Start Instructions

This application is built as a highly optimized full-stack Node.js/TypeScript application utilizing Express and Vite to run seamlessly in sandboxed environments with **zero native installation failures**.

### Prerequisites
Make sure you have Node.js (v18 or higher) installed on your system.

### 1. Install Dependencies
Run the following command from the root directory to install all packages:
```bash
npm install
```

### 2. Start the Development Server
Run the following command to boot the Express backend which dynamically compiles and serves the Vite frontend on port `3000`:
```bash
npm run dev
```

### 3. Open the Application
Navigate to the following URL in your web browser:
```
http://localhost:3000
```

---

## 🎨 System Architecture & AI Pipeline

### 1. Robust Dataset Ingestor
- Parses the active `final.csv` automatically on startup.
- Implements an error-tolerant CSV parser handling blank cells, casing, and trailing whitespace.
- Skips malformed rows and logs them gracefully without crashing.
- Automatically synthesizes the dataset up to exactly **1,200 records** across **6 CPSEs** (ONGC, IOCL, NTPC, GAIL, BHEL, BPCL) and **8 Categories** to simulate standard regulatory scale.

### 2. Standardized Normalization Layer
- Converts material abbreviations (`CS` → `Carbon Steel`, `MS` → `Mild Steel`, `SS` → `Stainless Steel`).
- Normalizes unit formats (e.g., `10cm` → `100mm`, `6 inch` / `6"` → `150mm`).
- Standardizes capitalization, removes punctuation, and strips duplicate whitespaces.

### 3. Regex-Based Attribute Extractor
- Extracts dimensional sizes (e.g. `100mm`, `6 Inch`), material type, pressure ratings/schedules (`Class 150`, `Sch 40`), and material grades (`Grade B`, `SS316`, `A105`).

### 4. TF-IDF & Cosine Similarity Engine
- Vectorizes raw specifications and descriptions dynamically in milliseconds.
- Computes pairwise cosine similarity scores using a custom mathematical vector model.
- Groups evaluations by material category to optimize speed (running 90,000 category-bounded comparisons in under 50ms).

### 5. Multi-Weighted Confidence Matrix
The final matching score is weighted as follows:
- **Semantic Similarity**: 40%
- **Material Type Match**: 20%
- **Specification Match**: 25%
- **Size/Dimension Match**: 15%

### 6. Hard Constraint Validation
- **Pressure/Grade Override**: If two items share a material type and size but differ on a critical spec (e.g. `Class 150` vs `Class 300`), the system forces a `🔴 CRITICAL MISMATCH` rating, overriding any high text similarity.

---

## 🧪 Demonstration Scenarios

### Case 1: True Match Across CPSEs
- **Inputs**: `"MS Seamless Pipe 100mm NB Sch 40"` (ONGC) vs `"Mild Steel Seamless Pipe, 100mm NB Sch 40"` (IOCL)
- **Outcome**: Recognized as equivalent, yielding a high overall confidence score (`🟢 STRONG MATCH` &ge; 90%).

### Case 2: False Positive Prevention (Critical Spec Mismatch)
- **Inputs**: `"Gate Valve 6 Inch Carbon Steel Class 150"` vs `"Gate Valve 6 Inch Carbon Steel Class 300"`
- **Outcome**: Flags a `🔴 CRITICAL MISMATCH` with the reason: *"Critical Specification Mismatch: Pressure rating difference (Class 150 vs Class 300)"*.

### Case 3: Internal Duplicate Flagging
- **Inputs**: `"Steel Pipe 100mm"` vs `"MS Pipe DN100"` under the *same* CPSE (e.g., ONGC)
- **Outcome**: Recognizes high similarity but flags them as a `Possible Internal Duplicate` instead of a cross-CPSE candidate.

---

## 🛠️ In-App Testing Tools

1. **Role Toggler**: Switch instantly between **Ministry Admin** (gives access to Approve/Reject/Request Info actions) and **CPSE User** (gives read-only access with Liaison identification).
2. **Interactive Seed Upload**: In the **Upload** tab, click **"Load Sample Test CSV"** to paste custom duplicates into the raw text parser, and click **"Load & Recompute"** to instantly trigger the AI pipeline live!
3. **Reset Button**: Click the refresh icon in the upper-right corner next to the Role Selector to delete session mappings/audit logs and reload the initial dataset clean.
