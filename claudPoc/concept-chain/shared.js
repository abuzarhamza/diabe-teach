// Shared in-browser mock of the Game Session API for the Concept Chain prototype screens.
// State mirrors docs/api/openapi.yaml (PublicSessionState, SubmittedChain, PlayerRoundStanding)
// and is kept in localStorage so a teacher tab and participant tabs stay in sync.
/* eslint-disable */
const CC = (() => {
  const KEY = "cc-demo-session-v1";
  const GRACE_MS = 5000; // fixed grace period after phaseEndsAt (see submitConceptChain 409)

  // Built-in Curriculum Packs: the topics of the earlier single-page prototype (claudPoc/ConceptChain (API overlay).html, SETS).
  // In the mock a pack is { packId, name, description, keywords, boardSize }. "diabe-teach" (Diabetes mellitus) is the
  // backend's seeded pack and the default; its keyword order is the one the demo always dealt from.
  const BUILTIN_PACKS = [
    { packId: "ipe", name: "Interprofessional teamwork", group: "Interprofessional learning", keywords: ["Interprofessional education","Collaborative practice","Shared goals","Roles and responsibilities","Scope of practice","Mutual respect","Trust","Values and ethics","Patient-centred care","Shared decision-making","Communication","SBAR","Closed-loop communication","Handover","ISBAR","Huddle","Briefing","Debriefing","Situation monitoring","Mutual support","Speaking up","CUS words","Two-challenge rule","Psychological safety","Hierarchy","Conflict resolution","Leadership","Followership","Team roles","Delegation","Workload","Medication error","Adverse event","Near miss","Incident reporting","Patient safety","Root cause analysis","Human factors","Situational awareness","Checklist","WHO surgical checklist","Care plan","Case conference","Discharge planning","Continuity of care","Family involvement","Simulation","Reflection","Professional identity"] },
    { packId: "ipediabetes", name: "Diabetes: the care team", group: "Interprofessional learning", keywords: ["Patient","Family","Physician","Endocrinologist","Diabetes nurse educator","Dietitian","Pharmacist","Podiatrist","Ophthalmologist","Psychologist","Social worker","Physiotherapist","Community health worker","Self-management","Education","Carbohydrate counting","Meal plan","Physical activity","Insulin technique","Injection sites","Glucometer","Hypoglycemia","Sick-day rules","HbA1c","Medication reconciliation","Adherence","Polypharmacy","Drug interactions","Foot examination","Monofilament","Foot ulcer","Footwear","Amputation","Retinal screening","Retinopathy","Depression","Diabetes distress","Smoking cessation","Weight management","Blood pressure","Lipids","Kidney function","Referral","Care plan","Shared goals","Follow-up","Telehealth","Cultural beliefs","Ramadan fasting"] },
    { packId: "diabe-teach", name: "Diabetes mellitus", group: "Clinical medicine", keywords: ["Retinopathy","Pancreas","Ulcer","Sulfonylureas","Metformin","Beta cells","Diet","Autoimmune","Glycemic index","Hypoglycemia","Weight loss","Adiponectin","Glucose","Hyperglycemia","Islet cells","Transplant","HHS","Amylin","Thiazolidinediones","Podiatrist","Polyphagia","ACE inhibitors","Screening","Microalbuminuria","Smoking","Genetic","Fasting","GTT","Glucagon","Neuropathy","Dyslipidaemia","Insulin","Weight","Polyuria","Glucometer","Polydipsia","Gastroparesis","C-Peptide","Venous","Ketoacidosis","Glucosuria","Hypertension","MODY","Lipohypertrophy","Children","Pregnancy","LADA","Glipizide","HbA1c"] },
    { packId: "thyroid", name: "Thyroid disorders", group: "Clinical medicine", keywords: ["Thyroxine (T4)","Triiodothyronine (T3)","TSH","TRH","Hypothalamus","Pituitary","Iodine","Thyroid peroxidase","Thyroglobulin","Graves disease","TSH receptor antibodies","Exophthalmos","Pretibial myxedema","Hashimoto thyroiditis","Anti-TPO","Hypothyroidism","Hyperthyroidism","Goitre","Toxic multinodular goitre","Thyroid storm","Myxedema coma","Weight gain","Weight loss","Heat intolerance","Cold intolerance","Tremor","Atrial fibrillation","Bradycardia","Constipation","Menorrhagia","Carbimazole","Propylthiouracil","Agranulocytosis","Radioactive iodine","Thyroidectomy","Levothyroxine","Beta-blockers","Subacute thyroiditis","Postpartum thyroiditis","Amiodarone","Lithium","Congenital hypothyroidism","Cretinism","Papillary carcinoma","Psammoma bodies","Fine-needle aspiration","Ultrasound","Hypocalcemia","Recurrent laryngeal nerve"] },
    { packId: "heartfailure", name: "Heart failure", group: "Clinical medicine", keywords: ["Cardiac output","Preload","Afterload","Contractility","Ejection fraction","HFrEF","HFpEF","Left ventricle","Right ventricle","Myocardial infarction","Hypertension","Valvular disease","Cardiomyopathy","Dyspnea","Orthopnea","Paroxysmal nocturnal dyspnea","Pulmonary edema","Crackles","Raised JVP","Peripheral edema","Hepatomegaly","S3 gallop","Fatigue","Cor pulmonale","BNP","Echocardiography","Chest X-ray","Cardiomegaly","Kerley B lines","RAAS","Aldosterone","Sodium retention","Sympathetic activation","Remodeling","ACE inhibitors","ARNI","Beta-blockers","Spironolactone","SGLT2 inhibitors","Loop diuretics","Furosemide","Digoxin","Hypokalemia","Atrial fibrillation","Arrhythmia","ICD","Fluid restriction","NYHA class","Renal impairment"] },
    { packId: "kidney", name: "Kidney disease (AKI & CKD)", group: "Clinical medicine", keywords: ["Nephron","Glomerulus","GFR","Creatinine","Urea","eGFR","Proteinuria","Albuminuria","Diabetic nephropathy","Hypertension","Glomerulonephritis","Polycystic kidney","Acute kidney injury","Prerenal","Acute tubular necrosis","Postrenal","Obstruction","NSAIDs","Contrast","Hyperkalemia","Metabolic acidosis","Bicarbonate","Fluid overload","Uremia","Pericarditis","Encephalopathy","Anemia","Erythropoietin","Renal osteodystrophy","Phosphate","Calcium","Vitamin D","PTH","Secondary hyperparathyroidism","ACE inhibitors","SGLT2 inhibitors","Dialysis","Hemodialysis","Peritoneal dialysis","Transplant","Immunosuppression","Ultrasound","Small kidneys","Urinalysis","Casts","Oliguria","Nephrotic syndrome","Edema","Hyperlipidemia"] },
    { packId: "anemia", name: "Anemia", group: "Clinical medicine", keywords: ["Hemoglobin","Red blood cell","Erythropoietin","Kidney","Bone marrow","Iron deficiency","Ferritin","Transferrin","TIBC","Microcytic","Hypochromic","MCV","Blood loss","Menorrhagia","Hookworm","Koilonychia","Pica","Vitamin B12","Folate","Megaloblastic","Macrocytic","Hypersegmented neutrophils","Pernicious anemia","Intrinsic factor","Subacute combined degeneration","Methotrexate","Anemia of chronic disease","Hepcidin","Hemolysis","Reticulocytes","Unconjugated bilirubin","Haptoglobin","LDH","Spherocytosis","G6PD deficiency","Heinz bodies","Sickle cell","HbS","Thalassemia","HbA2","Target cells","Aplastic anemia","Pancytopenia","Fatigue","Pallor","Tachycardia","Transfusion","Oral iron","Blood film"] },
    { packId: "airways", name: "Asthma and COPD", group: "Clinical medicine", keywords: ["Asthma","COPD","Airway obstruction","Reversibility","Spirometry","FEV1","FVC","FEV1/FVC ratio","Peak flow","Bronchodilator","Wheeze","Dyspnea","Chronic cough","Sputum","Smoking","Emphysema","Chronic bronchitis","Alpha-1 antitrypsin","Bullae","Hyperinflation","Barrel chest","Pursed-lip breathing","Type 2 inflammation","Eosinophils","IgE","Atopy","Allergens","Mast cells","Leukotrienes","Hyperresponsiveness","Salbutamol","Ipratropium","Tiotropium","Inhaled corticosteroids","LABA","Montelukast","Omalizumab","Inhaler technique","Spacer","Exacerbation","Oral prednisolone","Hypoxemia","Hypercapnia","Respiratory acidosis","Oxygen therapy","Cor pulmonale","Pulmonary rehabilitation","Vaccination","Smoking cessation"] },
    { packId: "sle", name: "Systemic lupus erythematosus", group: "Clinical medicine", keywords: ["Autoimmune","ANA","Anti-dsDNA","Anti-Smith","Antiphospholipid","Lupus anticoagulant","Complement","Low C3","Malar rash","Discoid rash","Photosensitivity","Oral ulcers","Arthritis","Serositis","Pericarditis","Pleuritis","Lupus nephritis","Proteinuria","Renal biopsy","Wire-loop lesions","Immune complex","Type III hypersensitivity","Hemolytic anemia","Thrombocytopenia","Leukopenia","Libman-Sacks","Endocarditis","Neuropsychiatric","Seizures","Women","Childbearing age","Pregnancy loss","Neonatal lupus","Heart block","Anti-Ro","Hydroxychloroquine","Corticosteroids","Mycophenolate","Cyclophosphamide","Belimumab","Drug-induced lupus","Hydralazine","Procainamide","Anti-histone","Fatigue","Fever","Raynaud phenomenon","Thrombosis","Retinal vasculitis"] },
    { packId: "amyloidosis", name: "Amyloidosis", group: "Clinical medicine", keywords: ["Amyloid","Beta-pleated sheet","Congo red","Apple-green birefringence","AL amyloid","AA amyloid","Light chains","Plasma cell","Multiple myeloma","Serum amyloid A","Rheumatoid arthritis","Chronic inflammation","Transthyretin","ATTR","Hereditary","Wild-type","Beta-2 microglobulin","Dialysis","Alzheimer disease","Amyloid beta","Nephrotic syndrome","Proteinuria","Cardiomyopathy","Restrictive","Low-voltage ECG","Macroglossia","Hepatomegaly","Carpal tunnel","Periorbital purpura","Fat pad biopsy","Rectal biopsy","Electron microscopy","Fibrils","Tafamidis","Bortezomib","Colchicine","Familial Mediterranean fever","Islet amyloid","Type 2 diabetes","Calcitonin","Medullary thyroid carcinoma","Free light chains","Electrophoresis","Echocardiography","Cardiac MRI","Neuropathy","Orthostatic hypotension","Kidney","Prognosis"] },
    { packId: "tb", name: "Tuberculosis", group: "Clinical medicine", keywords: ["M. tuberculosis","Acid-fast bacilli","Ziehl-Neelsen","Mycolic acid","Airborne","Droplet nuclei","Macrophage","Granuloma","Caseous necrosis","Langhans giant cells","Ghon focus","Ghon complex","Latent TB","Reactivation","Lung apex","Cavitation","Hemoptysis","Night sweats","Weight loss","Fever","Chronic cough","HIV","Immunosuppression","Miliary TB","TB meningitis","Pott disease","Spine","Lymphadenitis","Pleural effusion","Mantoux test","IGRA","BCG vaccine","Sputum","GeneXpert","Rifampicin resistance","Chest X-ray","Isoniazid","Peripheral neuropathy","Pyridoxine","Rifampicin","Orange urine","Pyrazinamide","Ethambutol","Optic neuritis","Hepatotoxicity","DOTS","MDR-TB","Contact tracing","Notification"] },
    { packId: "biochem", name: "Carbohydrate metabolism", group: "Basic sciences", keywords: ["Glucose","Hexokinase","Glucokinase","Glucose-6-phosphate","Glycolysis","Pyruvate","Lactate","Anaerobic","NADH","ATP","Pyruvate kinase","PFK-1","Fructose-2,6-bisphosphate","Insulin","Glucagon","cAMP","Protein kinase A","Glycogen","Glycogen synthase","Glycogen phosphorylase","Liver","Muscle","Gluconeogenesis","Pyruvate carboxylase","Oxaloacetate","PEPCK","Fructose-1,6-bisphosphatase","Cori cycle","Pentose phosphate pathway","NADPH","G6PD deficiency","Hemolysis","Red blood cell","Pyruvate dehydrogenase","Thiamine","Acetyl-CoA","TCA cycle","Electron transport chain","Oxygen","Mitochondria","Von Gierke disease","Hypoglycemia","Fasting","Ketone bodies","Fatty acids","Galactosemia","Fructose intolerance","Aldolase B","Lactose"] },
    { packId: "pathology", name: "Cell injury and inflammation", group: "Basic sciences", keywords: ["Cell injury","Hypoxia","Ischemia","ATP depletion","Reversible injury","Cell swelling","Fatty change","Necrosis","Apoptosis","Caspases","Coagulative necrosis","Liquefactive necrosis","Caseous necrosis","Fat necrosis","Fibrinoid necrosis","Gangrene","Free radicals","Reperfusion injury","Acute inflammation","Vasodilation","Increased permeability","Exudate","Edema","Neutrophils","Margination","Rolling","Selectins","Integrins","Diapedesis","Chemotaxis","Phagocytosis","Histamine","Prostaglandins","Leukotrienes","Bradykinin","Complement","Cytokines","TNF","IL-1","Fever","Chronic inflammation","Macrophages","Lymphocytes","Granuloma","Fibrosis","Repair","Regeneration","Scar","Angiogenesis"] },
    { packId: "pharma", name: "Autonomic pharmacology", group: "Pharmacology", keywords: ["Acetylcholine","Noradrenaline","Muscarinic receptor","Nicotinic receptor","Alpha-1","Alpha-2","Beta-1","Beta-2","Atropine","Pilocarpine","Neostigmine","Acetylcholinesterase","Organophosphates","Pralidoxime","Myasthenia gravis","Glaucoma","Miosis","Mydriasis","Bradycardia","Tachycardia","Bronchodilation","Salbutamol","Asthma","Propranolol","Atenolol","Hypertension","Prazosin","Clonidine","Adrenaline","Anaphylaxis","Dopamine","Dobutamine","Shock","Phenylephrine","Vasoconstriction","Tamsulosin","Prostatic hyperplasia","Succinylcholine","Neuromuscular block","Rocuronium","Sympathetic","Parasympathetic","Heart rate","Secretions","Urinary retention","Dry mouth","Ipratropium","COPD","Reflex tachycardia"] },
    { packId: "antimicrobials", name: "Antimicrobials", group: "Pharmacology", keywords: ["Penicillin","Beta-lactam ring","Cell wall","Peptidoglycan","Beta-lactamase","Amoxicillin","Clavulanic acid","Cephalosporins","Carbapenems","Vancomycin","MRSA","Red man syndrome","Aminoglycosides","Gentamicin","30S ribosome","Nephrotoxicity","Ototoxicity","Tetracyclines","Teeth discoloration","Macrolides","Azithromycin","50S ribosome","QT prolongation","Clindamycin","C. difficile","Fluoroquinolones","Ciprofloxacin","DNA gyrase","Tendon rupture","Sulfonamides","Trimethoprim","Folate synthesis","Metronidazole","Anaerobes","Disulfiram-like reaction","Linezolid","VRE","Bactericidal","Bacteriostatic","MIC","Resistance","Efflux pumps","Culture and sensitivity","Empirical therapy","Stewardship","Allergy","Anaphylaxis","Spectrum","Probenecid"] },
  ].map((p) => Object.freeze({ ...p, description: `${p.group} · built-in pack`, boardSize: Math.min(7, Math.floor(Math.sqrt(p.keywords.length))), builtIn: true }));
  const DEFAULT_PACK_ID = "diabe-teach";

  const PHASES = ["pretest","trial-orientation","round-1:chain-mapping","round-1:peer-adjudication","round-1:round-summary","round-2:chain-mapping","round-2:peer-adjudication","round-2:round-summary","posttest","feedback-survey","completed"];
  const PHASE_LABEL = {
    "pretest":"Pre-test","trial-orientation":"Trial round",
    "round-1:chain-mapping":"R1 · Chain mapping","round-1:peer-adjudication":"R1 · Peer review","round-1:round-summary":"R1 · Summary",
    "round-2:chain-mapping":"R2 · Chain mapping","round-2:peer-adjudication":"R2 · Peer review","round-2:round-summary":"R2 · Summary",
    "posttest":"Post-test","feedback-survey":"Survey","completed":"Completed",
  };
  // SessionTimerConfig (docs/api/openapi.yaml): whole seconds 1-86400 per phase; null = teacher-paced (phaseEndsAt null).
  // The demo's defaults (5 min chain mapping, 4 min peer review, everything else teacher-paced) are not the API's.
  const TIMER_FIELDS = ["pretestSec","trialOrientationSec","roundMappingSec","roundAdjudicationSec","posttestSec","feedbackSurveySec"];
  const DEFAULT_TIMER_CONFIG = Object.freeze({ pretestSec: null, trialOrientationSec: null, roundMappingSec: 300, roundAdjudicationSec: 240, posttestSec: null, feedbackSurveySec: null });
  const TIMER_MIN_SEC = 1, TIMER_MAX_SEC = 86400;
  const timerField = (phase) => ({ "pretest":"pretestSec", "trial-orientation":"trialOrientationSec", "posttest":"posttestSec", "feedback-survey":"feedbackSurveySec" })[phase]
    ?? (phase.endsWith(":chain-mapping") ? "roundMappingSec" : phase.endsWith(":peer-adjudication") ? "roundAdjudicationSec" : null);
  // Prototype-only settings (not in CreateSessionRequest): board size and shortest chain.
  const DEFAULT_BOARD_SIZE = 7, MIN_BOARD_SIZE = 3, MAX_BOARD_SIZE = 10, DEFAULT_MIN_CHAIN = 2;

  const listeners = [];
  const now = () => Date.now();
  const uid = (p) => `${p}_${Math.random().toString(36).slice(2, 8)}`;
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[c]));
  const newSeed = () => Math.random().toString(36).slice(2, 10);

  function hash(s) { let h = 2166136261; for (const c of s) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; }
  function rng(seed) { let a = hash(seed); return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

  function apiError(code, message) { const e = new Error(message); e.code = code; return e; }

  // Teacher-created packs, saved in this browser: { packId, name, group, level, objective, description, keywords, boardSize,
  // builtIn: false, createdAt }. They are plain keyword lists (a real registerCurriculumPack also needs card ids, domains, a rubric).
  const PACKS_KEY = "cc-demo-packs-v1", OWN_GROUP = "Your packs";
  const MIN_PACK_KEYWORDS = MIN_BOARD_SIZE * MIN_BOARD_SIZE, MAX_KEYWORD_LENGTH = 60;
  const maxBoardSize = (pack) => Math.min(MAX_BOARD_SIZE, Math.floor(Math.sqrt(pack.keywords.length)));
  function ownPacks() {
    try { const a = JSON.parse(localStorage.getItem(PACKS_KEY)); return Array.isArray(a) ? a.filter((p) => p && p.packId && Array.isArray(p.keywords)) : []; }
    catch { return []; }
  }
  function listPacks() { return [...ownPacks(), ...BUILTIN_PACKS]; }
  function getPack(packId) { return listPacks().find((p) => p.packId === packId) ?? null; }

  // Splits pasted or uploaded text (.txt: one per line; .csv: comma, semicolon or tab separated, optional "quotes")
  // into keywords. Trims, drops empty entries and case-insensitive duplicates (keeping the first spelling), and counts both.
  // Also accepts an array of strings (e.g. an existing list plus new text).
  function cleanKeywords(input) {
    const raw = Array.isArray(input) ? input.map((x) => String(x ?? "")) : String(input ?? "").replace(/\s+$/, "").split(/\r?\n|[,;\t]/);
    const seen = new Set(), keywords = []; let empty = 0, duplicates = 0;
    for (const r of raw) {
      const k = r.trim().replace(/^"(.*)"$/, "$1").replace(/""/g, '"').replace(/\s+/g, " ").trim();
      if (!k) { empty++; continue; }
      const key = k.toLowerCase();
      if (seen.has(key)) { duplicates++; continue; }
      seen.add(key); keywords.push(k);
    }
    return { keywords, empty, duplicates };
  }
  // Saves a new teacher-created pack. Needs a unique name and at least 9 distinct keywords (a 3×3 board).
  function savePack({ name, level = "", objective = "", keywords } = {}) {
    const bad = (msg) => { throw apiError("INVALID_REQUEST_BODY", msg); };
    const nm = String(name ?? "").trim().replace(/\s+/g, " ");
    if (!nm) bad("Give the pack a name.");
    if (nm.length > 80) bad("Keep the pack name to 80 characters or fewer.");
    if (listPacks().some((p) => p.name.toLowerCase() === nm.toLowerCase())) bad(`There is already a pack called "${nm}". Choose another name.`);
    const { keywords: kws } = cleanKeywords(Array.isArray(keywords) ? keywords : String(keywords ?? ""));
    if (kws.length < MIN_PACK_KEYWORDS) bad(`A pack needs at least ${MIN_PACK_KEYWORDS} different keywords (a 3×3 board); this one has ${kws.length}.`);
    const long = kws.find((k) => k.length > MAX_KEYWORD_LENGTH);
    if (long) bad(`Keep each keyword to ${MAX_KEYWORD_LENGTH} characters or fewer ("${long.slice(0, 30)}…").`);
    const lv = String(level ?? "").trim(), obj = String(objective ?? "").trim();
    const pack = { packId: uid("pack"), name: nm, group: OWN_GROUP, level: lv, objective: obj,
      description: [lv, obj].filter(Boolean).join(" · ") || "Your pack", keywords: kws,
      boardSize: Math.min(DEFAULT_BOARD_SIZE, Math.floor(Math.sqrt(kws.length))), builtIn: false, createdAt: new Date().toISOString() };
    localStorage.setItem(PACKS_KEY, JSON.stringify([pack, ...ownPacks()]));
    return pack;
  }
  // Deletes a teacher-created pack. Built-in packs can't be deleted. A running session keeps its own copy of the pack.
  function deletePack(packId) {
    if (BUILTIN_PACKS.some((p) => p.packId === packId)) throw apiError("INVALID_REQUEST_BODY", "Built-in packs can't be deleted.");
    const own = ownPacks(); if (!own.some((p) => p.packId === packId)) throw apiError("PACK_NOT_FOUND", `No Curriculum Pack "${packId}".`);
    localStorage.setItem(PACKS_KEY, JSON.stringify(own.filter((p) => p.packId !== packId)));
  }

  // Game setup's last choices ({ packId, timerConfig, boardSize, minChainLength }), pre-filled on the next visit.
  const SETUP_KEY = "cc-demo-setup-v1";
  function lastSetup() { try { const v = JSON.parse(localStorage.getItem(SETUP_KEY)); return v && typeof v === "object" ? v : null; } catch { return null; } }
  function rememberSetup(settings) {
    const { packId, timerConfig, boardSize, minChainLength } = settings ?? {};
    localStorage.setItem(SETUP_KEY, JSON.stringify({ packId, timerConfig, boardSize, minChainLength }));
  }

  // Deals a size x size board from a pack's keywords. Same pack + size + seed always gives the same board.
  // `pack` (a pack object) can be given instead of packId, e.g. the copy a session keeps.
  function dealBoard({ packId = DEFAULT_PACK_ID, pack: given, boardSize = DEFAULT_BOARD_SIZE, seed } = {}) {
    const pack = given ?? getPack(packId); if (!pack) throw apiError("PACK_NOT_FOUND", `No Curriculum Pack "${packId}".`);
    if (boardSize > maxBoardSize(pack)) throw apiError("INVALID_REQUEST_BODY", `${pack.name} has ${pack.keywords.length} keywords: too few for a ${boardSize}×${boardSize} board (needs ${boardSize * boardSize}).`);
    const r = rng(String(seed)); const w = pack.keywords.slice();
    for (let i = w.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [w[i], w[j]] = [w[j], w[i]]; }
    const rows = boardSize, cols = boardSize, cells = [];
    for (let row = 0; row < rows; row++) cells.push(w.slice(row * cols, row * cols + cols).map((label) => ({ keywordId: label.toLowerCase().replace(/[^a-z0-9]+/g, "-"), label })));
    return { seed: String(seed), rows, cols, cells };
  }

  // Checks and fills in settings shaped like CreateSessionRequest (+ prototype-only boardSize, minChainLength).
  // Throws INVALID_REQUEST_BODY / PACK_NOT_FOUND with a message a teacher can read.
  function normalizeSettings(input = {}) {
    const bad = (msg) => { throw apiError("INVALID_REQUEST_BODY", msg); };
    const packId = input.packId ?? DEFAULT_PACK_ID, pack = getPack(packId);
    if (!pack) throw apiError("PACK_NOT_FOUND", `No Curriculum Pack "${packId}".`);
    const tc = input.timerConfig ?? {};
    if (typeof tc !== "object" || Array.isArray(tc)) bad("timerConfig must be an object.");
    for (const k of Object.keys(tc)) if (!TIMER_FIELDS.includes(k)) bad(`timerConfig.${k} is not a known timer.`);
    const timerConfig = {};
    for (const k of TIMER_FIELDS) {
      const v = k in tc ? tc[k] : DEFAULT_TIMER_CONFIG[k];
      if (v !== null && !(Number.isInteger(v) && v >= TIMER_MIN_SEC && v <= TIMER_MAX_SEC))
        bad(`timerConfig.${k} must be a whole number of seconds from ${TIMER_MIN_SEC} to ${TIMER_MAX_SEC} (24 hours), or null for teacher-paced.`);
      timerConfig[k] = v;
    }
    const boardSize = input.boardSize ?? Math.min(DEFAULT_BOARD_SIZE, maxBoardSize(pack));
    if (!Number.isInteger(boardSize) || boardSize < MIN_BOARD_SIZE || boardSize > maxBoardSize(pack))
      bad(`Board size must be a whole number from ${MIN_BOARD_SIZE} to ${maxBoardSize(pack)} for ${pack.name} (${pack.keywords.length} keywords).`);
    const minChainLength = input.minChainLength ?? DEFAULT_MIN_CHAIN;
    if (!Number.isInteger(minChainLength) || minChainLength < 2 || minChainLength > boardSize * boardSize)
      bad(`Shortest chain must be a whole number from 2 to ${boardSize * boardSize}.`);
    if (input.seed != null && (typeof input.seed !== "string" || !input.seed.trim())) bad("seed must be a non-empty string.");
    if (input.creatorDisplayName != null && typeof input.creatorDisplayName !== "string") bad("creatorDisplayName must be a string.");
    return { packId, mode: input.mode ?? "classroom", adjudicationMode: input.adjudicationMode ?? "peer-instructor", timerConfig,
      seed: input.seed ?? null, creatorDisplayName: input.creatorDisplayName?.trim() || null, boardSize, minChainLength };
  }
  // A stored session's settings (sessions saved before settings existed get the defaults).
  const settingsOf = (s) => s.settings ?? normalizeSettings();
  // The pack a session plays: the copy taken at creation (so deleting a saved pack doesn't break a running game).
  const packOf = (s) => s.pack ?? getPack(settingsOf(s).packId);

  function fresh(input) {
    const settings = normalizeSettings(input);
    const roomCode = Array.from({ length: 6 }, () => "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"[Math.floor(Math.random() * 32)]).join("");
    const s = {
      session: { sessionId: uid("ses"), roomCode, packId: settings.packId, mode: settings.mode, adjudicationMode: settings.adjudicationMode,
        currentPhase: "pretest", activeRoundNumber: null, phaseStartedAt: new Date().toISOString(), phaseEndsAt: null, activeBoard: null, participantCount: 0 },
      settings, participants: [], chains: [],
    };
    const p = getPack(settings.packId);
    s.pack = { packId: p.packId, name: p.name, level: p.level ?? "", objective: p.objective ?? "", keywords: p.keywords.slice(), builtIn: !!p.builtIn };
    s.session.phaseEndsAt = phaseEnd(settings, "pretest");
    return s;
  }
  function phaseEnd(settings, phase) {
    const f = timerField(phase), sec = f ? settings.timerConfig[f] : null;
    return sec ? new Date(now() + sec * 1000).toISOString() : null;
  }

  // Phase length from Game setup: whole minutes 1-1440 (1440 min = TIMER_MAX_SEC), or teacher-paced (null).
  const TIMER_MAX_MIN = TIMER_MAX_SEC / 60;
  function timerFromMinutes(minutes, teacherPaced = false) {
    if (teacherPaced) return null;
    const m = typeof minutes === "string" ? (minutes.trim() === "" ? NaN : Number(minutes)) : minutes;
    if (!Number.isInteger(m) || m < 1 || m > TIMER_MAX_MIN) throw apiError("INVALID_REQUEST_BODY", `Enter whole minutes from 1 to ${TIMER_MAX_MIN} (24 hours), or make it teacher-paced.`);
    return m * 60;
  }

  const timerLabel = (sec) => sec == null ? "Teacher-paced" : sec < 60 ? `${sec} s` : sec % 60 ? `${Math.floor(sec / 60)} min ${sec % 60} s` : `${sec / 60} min`;

  // Demo teacher sign-in: name + email remembered in this browser. No password, nothing secret (not a real account).
  const TEACHER_KEY = "cc-demo-teacher-v1";
  function teacher() { try { const t = JSON.parse(localStorage.getItem(TEACHER_KEY)); return t && t.name && t.email ? t : null; } catch { return null; } }
  function signIn(name, email) {
    const n = String(name ?? "").trim(), e = String(email ?? "").trim();
    if (!n) throw apiError("INVALID_REQUEST_BODY", "Enter your name.");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) throw apiError("INVALID_REQUEST_BODY", "Enter a valid email address, like name@school.org.");
    const t = { name: n.slice(0, 60), email: e, signedInAt: new Date().toISOString() };
    localStorage.setItem(TEACHER_KEY, JSON.stringify(t)); return t;
  }
  function signOut() { localStorage.removeItem(TEACHER_KEY); }
  // Guard for teacher pages: returns the signed-in teacher, or hides the page and sends the browser to Teacher login.
  function requireTeacher(loginUrl = "login.html") {
    const t = teacher(); if (t) return t;
    document.documentElement.style.visibility = "hidden"; location.replace(loginUrl); return null;
  }

  function load() { try { return JSON.parse(localStorage.getItem(KEY)) || null; } catch { return null; } }
  function get() { let s = load(); if (!s) { s = fresh(); localStorage.setItem(KEY, JSON.stringify(s)); } return s; }
  function save(s) { s.session.participantCount = s.participants.length; localStorage.setItem(KEY, JSON.stringify(s)); listeners.forEach((fn) => fn(s)); }
  function update(mut) { const s = get(); const out = mut(s); save(s); return out; }
  function subscribe(fn) { listeners.push(fn); window.addEventListener("storage", (e) => { if (e.key === KEY) fn(get()); }); }
  function reset() { const s = fresh(); save(s); return s; }
  // Creates a new demo Game Session from CreateSessionRequest-shaped settings, replacing the stored one (like reset()).
  function createSession(settings) { const s = fresh(settings); save(s); return s; }

  function enterPhase(s, phase) {
    const ss = s.session;
    ss.currentPhase = phase;
    const m = /^round-(\d)/.exec(phase);
    ss.activeRoundNumber = m ? Number(m[1]) : null;
    const set = settingsOf(s);
    // Round 1 uses the creation seed (the board Game setup previewed); Round 2, or a session made without a seed, gets a fresh one.
    if (phase.endsWith(":chain-mapping")) ss.activeBoard = dealBoard({ packId: set.packId, pack: s.pack, boardSize: set.boardSize,
      seed: ss.activeRoundNumber === 1 && set.seed ? set.seed : `${ss.sessionId}-r${ss.activeRoundNumber}-${now()}` });
    if (!m) ss.activeBoard = null;
    ss.phaseStartedAt = new Date().toISOString();
    ss.phaseEndsAt = phaseEnd(set, phase);
  }
  function advance() { return update((s) => { const i = PHASES.indexOf(s.session.currentPhase); if (i >= PHASES.length - 1) throw apiError("INVALID_PHASE_TRANSITION", "Session already completed."); enterPhase(s, PHASES[i + 1]); }); }
  function extend(sec) { return update((s) => { const ss = s.session; const base = ss.phaseEndsAt ? Math.max(now(), Date.parse(ss.phaseEndsAt)) : now(); ss.phaseEndsAt = new Date(base + sec * 1000).toISOString(); }); }

  function join(roomCode, displayName) {
    return update((s) => {
      if (roomCode.trim().toUpperCase() !== s.session.roomCode) throw apiError("SESSION_NOT_FOUND", "No session with that room code.");
      const p = { participantId: uid("par"), displayName: displayName.trim() || "Learner", joinedAt: new Date().toISOString() };
      s.participants.push(p); return p;
    });
  }

  const adjacent = (a, b) => Math.max(Math.abs(a.row - b.row), Math.abs(a.col - b.col)) === 1; // chebyshev-8
  function topologyError(path, minLength = DEFAULT_MIN_CHAIN) {
    if (path.length < minLength) return minLength === 2 ? "A chain needs at least two keywords." : `A chain needs at least ${minLength} keywords.`;
    const seen = new Set();
    for (let i = 0; i < path.length; i++) {
      const k = `${path[i].row},${path[i].col}`; if (seen.has(k)) return "A keyword can only appear once in a chain."; seen.add(k);
      if (i && !adjacent(path[i - 1], path[i])) return "Each keyword must touch the previous one (sideways, up/down or diagonal).";
    }
    return null;
  }
  function submissionsOpen(s) {
    const ss = s.session;
    if (!ss.currentPhase.endsWith(":chain-mapping")) return false;
    return !ss.phaseEndsAt || now() <= Date.parse(ss.phaseEndsAt) + GRACE_MS;
  }

  function submitChain(participantId, path, narrativeExplanation, stepRationales) {
    return update((s) => {
      if (!submissionsOpen(s)) throw apiError("PHASE_CLOSED_FOR_SUBMISSIONS", "Chain mapping is closed for this round.");
      const err = topologyError(path, settingsOf(s).minChainLength); if (err) throw apiError("CHAIN_TOPOLOGY_INVALID", err);
      if (!narrativeExplanation.trim()) throw apiError("INVALID_REQUEST_BODY", "Add a narrative explanation.");
      const b = s.session.activeBoard;
      const chain = { chainId: uid("chn"), sessionId: s.session.sessionId, roundNumber: s.session.activeRoundNumber, participantId,
        path, keywordIds: path.map((c) => b.cells[c.row][c.col].keywordId), labels: path.map((c) => b.cells[c.row][c.col].label),
        narrativeExplanation: narrativeExplanation.trim(), stepRationales, status: "pending-review", verdict: null, peerVotes: [], submittedAt: new Date().toISOString() };
      s.chains.push(chain); return chain;
    });
  }

  // Demo peer-consensus rule: 2+ votes and a clear majority settles an unlocked chain.
  function applyPeerConsensus(c) {
    if (c.verdict?.isLocked) return;
    const up = c.peerVotes.filter((v) => v.decision === "approve").length, down = c.peerVotes.length - up;
    if (c.peerVotes.length >= 2 && up !== down) {
      c.status = up > down ? "approved" : "rejected";
      c.verdict = { isApproved: up > down, adjudicatorType: "peer-consensus", isLocked: false, qualityScore: Math.max(1, Math.round((up / c.peerVotes.length) * 10)), transitionEvaluations: [], overallFeedback: `${up} approve · ${down} challenge`, suggestedRefinements: null };
    } else { c.status = "pending-review"; c.verdict = null; }
  }

  function vote(chainId, voterParticipantId, decision, comment) {
    return update((s) => {
      const c = s.chains.find((x) => x.chainId === chainId); if (!c) throw apiError("CHAIN_NOT_FOUND", "Chain not found.");
      if (!s.session.currentPhase.endsWith(":peer-adjudication")) throw apiError("PHASE_CLOSED", "Peer review is not open.");
      if (c.participantId === voterParticipantId) throw apiError("FORBIDDEN_ROLE", "You can't vote on your own chain.");
      if (c.verdict?.isLocked) throw apiError("ADJUDICATION_LOCKED_BY_INSTRUCTOR", "Your teacher has already ruled on this chain.");
      c.peerVotes = c.peerVotes.filter((v) => v.voterParticipantId !== voterParticipantId);
      c.peerVotes.push({ voterParticipantId, decision, comment: comment?.trim() || null, votedAt: new Date().toISOString() });
      applyPeerConsensus(c); return c;
    });
  }

  function rule(chainId, approve, feedback, qualityScore) {
    return update((s) => {
      const c = s.chains.find((x) => x.chainId === chainId); if (!c) throw apiError("CHAIN_NOT_FOUND", "Chain not found.");
      if (c.verdict?.isLocked) throw apiError("ADJUDICATION_LOCKED_BY_INSTRUCTOR", "This chain already has a final ruling.");
      if (!feedback.trim()) throw apiError("INVALID_REQUEST_BODY", "Feedback is required for a final ruling.");
      c.status = approve ? "approved" : "rejected";
      c.verdict = { isApproved: approve, adjudicatorType: "instructor-final", isLocked: true, qualityScore, transitionEvaluations: [], overallFeedback: feedback.trim(), suggestedRefinements: null };
      return c;
    });
  }

  // Longest approved chain first, then number of approved chains.
  function standings(s, round) {
    return s.participants.map((p) => {
      const ok = s.chains.filter((c) => c.roundNumber === round && c.participantId === p.participantId && c.status === "approved");
      return { participantId: p.participantId, displayName: p.displayName, longestValidChainLength: Math.max(0, ...ok.map((c) => c.path.length)),
        totalValidChainsCount: ok.length, pendingCount: s.chains.filter((c) => c.roundNumber === round && c.participantId === p.participantId && c.status === "pending-review").length };
    }).sort((a, b) => b.longestValidChainLength - a.longestValidChainLength || b.totalValidChainsCount - a.totalValidChainsCount || a.displayName.localeCompare(b.displayName))
      .map((r, i) => ({ rank: i + 1, ...r }));
  }

  // Demo helper: add learners and, during a round, a few random valid chains for them.
  function seedSampleLearners() {
    return update((s) => {
      for (const name of ["Aisha", "Ben", "Chen"]) if (!s.participants.some((p) => p.displayName === name)) s.participants.push({ participantId: uid("par"), displayName: name, joinedAt: new Date().toISOString() });
      const b = s.session.activeBoard; if (!b) return;
      const r = rng(`${b.seed}-sample-${s.chains.length}`);
      for (const p of s.participants.filter((x) => ["Aisha", "Ben", "Chen"].includes(x.displayName))) {
        const len = 3 + Math.floor(r() * 3), path = [{ row: Math.floor(r() * b.rows), col: Math.floor(r() * b.cols) }];
        while (path.length < len) {
          const last = path.at(-1), opts = [];
          for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) { const n = { row: last.row + dr, col: last.col + dc }; if ((dr || dc) && n.row >= 0 && n.col >= 0 && n.row < b.rows && n.col < b.cols && !path.some((q) => q.row === n.row && q.col === n.col)) opts.push(n); }
          if (!opts.length) break; path.push(opts[Math.floor(r() * opts.length)]);
        }
        const labels = path.map((c) => b.cells[c.row][c.col].label);
        s.chains.push({ chainId: uid("chn"), sessionId: s.session.sessionId, roundNumber: s.session.activeRoundNumber, participantId: p.participantId, path,
          keywordIds: path.map((c) => b.cells[c.row][c.col].keywordId), labels,
          narrativeExplanation: `${labels.join(" leads to ")} — sample narrative from ${p.displayName}.`,
          stepRationales: path.slice(1).map((c, i) => ({ fromCoord: path[i], toCoord: c, rationale: `${labels[i]} relates to ${labels[i + 1]}.` })),
          status: "pending-review", verdict: null, peerVotes: [], submittedAt: new Date().toISOString() });
      }
    });
  }

  function clock(s) {
    const ends = s.session.phaseEndsAt;
    if (!ends) return { text: "—:—", note: "Teacher-paced", over: false };
    const ms = Date.parse(ends) - now(), t = Math.max(0, Math.ceil(ms / 1000));
    return { text: `${String(Math.floor(t / 60)).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`, note: ms <= 0 ? "Time's up" : "remaining", over: ms <= 0, low: ms > 0 && ms < 30000 };
  }

  // The teacher's phase-button label for moving on from `phase`. Starting Round 2 deals a fresh board, so it says so.
  function nextPhaseLabel(phase) {
    const next = PHASES[PHASES.indexOf(phase) + 1];
    if (!next) return null;
    return next === "round-2:chain-mapping" ? "Start Round 2 · new board →" : `Start ${PHASE_LABEL[next]} →`;
  }

  // Renders the board grid plus an SVG overlay drawing `path` (array of {row,col}).
  function renderBoard(shell, board, { path = [], color = "var(--pick)", onTap, tappable } = {}) {
    if (!board) { shell.innerHTML = `<div class="board-empty">The board appears when a round starts.</div>`; return; }
    const at = (r, c) => path.findIndex((p) => p.row === r && p.col === c);
    const last = path.at(-1);
    let html = `<div class="board" style="grid-template-columns:repeat(${board.cols},1fr);grid-template-rows:repeat(${board.rows},1fr)">`;
    board.cells.forEach((row, r) => row.forEach((cell, c) => {
      const i = at(r, c), near = tappable && last && i < 0 && adjacent(last, { row: r, col: c });
      html += `<button type="button" class="tile${i >= 0 ? " in" : ""}${near ? " near" : ""}" data-r="${r}" data-c="${c}" ${tappable ? "" : "tabindex=-1"} aria-pressed="${i >= 0}" aria-label="${esc(cell.label)}${i >= 0 ? `, step ${i + 1}` : ""}">${i >= 0 ? `<span class="ord">${i + 1}</span>` : ""}${esc(cell.label)}</button>`;
    }));
    html += `</div><svg class="overlay" aria-hidden="true"></svg>`;
    shell.innerHTML = html;
    shell.style.setProperty("--tile-fs", `${Math.max(9, Math.min(15, shell.clientWidth / board.cols / 6.2))}px`);
    if (onTap) shell.querySelectorAll(".tile").forEach((t) => t.addEventListener("click", () => onTap({ row: +t.dataset.r, col: +t.dataset.c }, t)));
    requestAnimationFrame(() => {
      const svg = shell.querySelector("svg.overlay"); if (!svg || path.length < 2) return;
      const box = shell.getBoundingClientRect();
      const pts = path.map((p) => { const el = shell.querySelector(`.tile[data-r="${p.row}"][data-c="${p.col}"]`).getBoundingClientRect(); return `${el.left - box.left + el.width / 2},${el.top - box.top + el.height / 2}`; });
      svg.setAttribute("viewBox", `0 0 ${box.width} ${box.height}`);
      svg.innerHTML = `<polyline points="${pts.join(" ")}" fill="none" stroke="${color}" stroke-width="6" stroke-linecap="round" stroke-linejoin="round" opacity=".55"/>`;
    });
  }

  const STATUS = { "pending-review": ["pending", "To check"], approved: ["valid", "Approved"], rejected: ["invalid", "Not approved"] };
  function statusBadge(c) {
    const [cls, txt] = STATUS[c.status];
    const by = c.verdict ? (c.verdict.adjudicatorType === "instructor-final" ? " · teacher ruling 🔒" : " · peer consensus") : "";
    return `<span class="status ${cls}">${txt}${by}</span>`;
  }
  const chainText = (c) => c.labels.map((l) => `<b>${esc(l)}</b>`).join(` <span class="arrow">→</span> `);

  return { PHASES, PHASE_LABEL, DEFAULT_PACK_ID, DEFAULT_TIMER_CONFIG, TIMER_FIELDS, TIMER_MIN_SEC, TIMER_MAX_SEC, MIN_BOARD_SIZE,
    MIN_PACK_KEYWORDS, listPacks, getPack, cleanKeywords, savePack, deletePack, lastSetup, rememberSetup, packOf, dealBoard, newSeed, normalizeSettings, settingsOf, createSession, timerFromMinutes, timerLabel, TIMER_MAX_MIN,
    teacher, signIn, signOut, requireTeacher,
    get, subscribe, reset, advance, extend, join, submitChain, vote, rule, standings, seedSampleLearners,
    topologyError, submissionsOpen, adjacent, clock, nextPhaseLabel, renderBoard, statusBadge, chainText, esc };
})();
