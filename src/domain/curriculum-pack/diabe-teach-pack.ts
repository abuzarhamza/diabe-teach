import { CurriculumPack } from "./curriculum-pack.js";

export const DIABE_TEACH_PACK: CurriculumPack = CurriculumPack.create({
  id: "diabe-teach",
  title: "Diabe-teach: Undergraduate Diabetes Mellitus Clinical Reasoning",
  version: "1.0.0",
  description:
    "Evidence-based 49-keyword associative concept-chaining board game for undergraduate medical education in diabetes mellitus (Shadan et al., BMC Medical Education 2025, 25:17).",
  boardConfig: {
    rows: 7,
    cols: 7,
    minChainLength: 4,
    adjacencyRule: "chebyshev-8",
  },
  domains: [
    {
      id: "anatomy-pathophysiology",
      label: "Anatomy & Pathophysiology",
      description:
        "Pancreatic islet histology, endocrine hormones, adipokines, and glucose homeostasis.",
    },
    {
      id: "subtypes-genetics",
      label: "Disease Subtypes & Genetics",
      description:
        "Etiological classifications, autoimmune pathogenesis, genetic susceptibility, and demographic presentations.",
    },
    {
      id: "signs-symptoms",
      label: "Cardinal Signs & Symptoms",
      description:
        "Classic osmotic and catabolic clinical presentations of untreated hyperglycemia.",
    },
    {
      id: "acute-crises",
      label: "Acute Metabolic Crises",
      description:
        "Life-threatening hyperglycemic and iatrogenic hypoglycemic metabolic emergencies.",
    },
    {
      id: "diagnostics-monitoring",
      label: "Diagnostic & Monitoring Tools",
      description:
        "Laboratory assays, glycemic biomarkers, screening protocols, and self-monitoring devices.",
    },
    {
      id: "therapeutics-multidisciplinary",
      label: "Therapeutics & Multidisciplinary Care",
      description:
        "Oral hypoglycemic classes, renoprotective agents, nutrition, surgical transplantation, and podiatric care.",
    },
    {
      id: "complications-risk-factors",
      label: "Complications & Risk Factors",
      description:
        "Microvascular and macrovascular end-organ damage, injection complications, and cardiometabolic risk factors.",
    },
  ],
  cards: [
    {
      id: "ace-inhibitors",
      verbatimLabel: "ACE Inhibitors",
      displayLabel: "ACE Inhibitors",
      aliases: ["ACE Inhibitor", "ACEi"],
      domainId: "therapeutics-multidisciplinary",
      summary:
        "Renoprotective antihypertensive agents that reduce intraglomerular pressure and slow progression of diabetic nephropathy.",
    },
    {
      id: "adiponectin",
      verbatimLabel: "Adiponectin",
      displayLabel: "Adiponectin",
      aliases: [],
      domainId: "anatomy-pathophysiology",
      summary:
        "Anti-inflammatory, insulin-sensitizing adipokine secreted by adipose tissue whose circulating levels decrease in obesity and T2DM.",
    },
    {
      id: "amylin",
      verbatimLabel: "Amylin",
      displayLabel: "Amylin",
      aliases: ["Islet amyloid polypeptide", "IAPP"],
      domainId: "anatomy-pathophysiology",
      summary:
        "Peptide hormone co-secreted with insulin by pancreatic beta cells that suppresses postprandial glucagon and slows gastric emptying.",
    },
    {
      id: "autoimmune",
      verbatimLabel: "Autoimmune",
      displayLabel: "Autoimmune",
      aliases: ["Auto-Immune", "Autoimmunity"],
      domainId: "subtypes-genetics",
      summary:
        "Immune-mediated destruction of insulin-producing pancreatic islet beta cells driving Type 1 DM and LADA.",
    },
    {
      id: "beta-cells",
      verbatimLabel: "Beta cells",
      displayLabel: "Beta Cells",
      aliases: ["Beta cell", "Pancreatic beta cells"],
      domainId: "anatomy-pathophysiology",
      summary:
        "Endocrine cells within the pancreatic islets of Langerhans that synthesize and secrete insulin and amylin.",
    },
    {
      id: "c-peptide",
      verbatimLabel: "C-Peptide",
      displayLabel: "C-Peptide",
      aliases: ["C Peptide", "Connecting peptide"],
      domainId: "diagnostics-monitoring",
      summary:
        "Connecting peptide cleaved from proinsulin in equimolar amounts to endogenous insulin; biomarker of endogenous beta-cell reserve.",
    },
    {
      id: "children",
      verbatimLabel: "Children",
      displayLabel: "Children",
      aliases: ["Pediatric", "Childhood"],
      domainId: "subtypes-genetics",
      summary:
        "Pediatric population where Type 1 DM is the classic presentation alongside rising rates of obesity-associated pediatric T2DM.",
    },
    {
      id: "diet",
      verbatimLabel: "Diet",
      displayLabel: "Diet",
      aliases: ["Medical nutrition therapy", "Nutrition"],
      domainId: "therapeutics-multidisciplinary",
      summary:
        "Structured nutritional management controlling carbohydrate intake, glycemic load, and caloric balance.",
    },
    {
      id: "dys-lipidaemia",
      verbatimLabel: "Dys-lipidaemia",
      displayLabel: "Dyslipidaemia",
      aliases: ["Dyslipidemia", "Dyslipidaemia"],
      domainId: "complications-risk-factors",
      summary:
        "Atherogenic diabetic lipid triad characterized by elevated triglycerides, low HDL cholesterol, and small dense LDL particles.",
    },
    {
      id: "fasting",
      verbatimLabel: "Fasting",
      displayLabel: "Fasting",
      aliases: ["Fasting plasma glucose", "FPG"],
      domainId: "diagnostics-monitoring",
      summary:
        "Fasting plasma glucose measurement after at least 8 hours without caloric intake (>=126 mg/dL diagnostic of diabetes).",
    },
    {
      id: "gastro-paresis",
      verbatimLabel: "Gastro-paresis",
      displayLabel: "Gastroparesis",
      aliases: ["Gastroparesis"],
      domainId: "complications-risk-factors",
      summary:
        "Delayed gastric emptying without mechanical obstruction caused by diabetic vagal autonomic neuropathy.",
    },
    {
      id: "genetic",
      verbatimLabel: "Genetic",
      displayLabel: "Genetic",
      aliases: ["Genetics", "Hereditary"],
      domainId: "subtypes-genetics",
      summary:
        "Polygenic susceptibility alleles in T1DM/T2DM and autosomal dominant monogenic mutations in MODY.",
    },
    {
      id: "glipizide",
      verbatimLabel: "Glipizide",
      displayLabel: "Glipizide",
      aliases: [],
      domainId: "therapeutics-multidisciplinary",
      summary:
        "Second-generation sulfonylurea secretagogue that closes ATP-sensitive potassium channels on pancreatic beta cells.",
    },
    {
      id: "glucagon",
      verbatimLabel: "Glucagon",
      displayLabel: "Glucagon",
      aliases: [],
      domainId: "anatomy-pathophysiology",
      summary:
        "Counter-regulatory hormone secreted by pancreatic alpha cells that stimulates hepatic glycogenolysis and gluconeogenesis.",
    },
    {
      id: "glucometer",
      verbatimLabel: "Glucometer",
      displayLabel: "Glucometer",
      aliases: ["Blood glucose monitor", "SMBG"],
      domainId: "diagnostics-monitoring",
      summary:
        "Portable point-of-care device for capillary self-monitoring of blood glucose to guide therapy and detect hypoglycemia.",
    },
    {
      id: "glucose",
      verbatimLabel: "Glucose",
      displayLabel: "Glucose",
      aliases: ["Blood glucose"],
      domainId: "anatomy-pathophysiology",
      summary:
        "Primary circulating monosaccharide substrate whose cellular uptake and hepatic output are dysregulated in diabetes mellitus.",
    },
    {
      id: "glucosuria",
      verbatimLabel: "Glucosuria",
      displayLabel: "Glucosuria",
      aliases: ["Glycosuria"],
      domainId: "signs-symptoms",
      summary:
        "Urinary excretion of glucose occurring when filtered plasma glucose exceeds the proximal renal tubular transport maximum.",
    },
    {
      id: "glycemic-index",
      verbatimLabel: "Glycemic index",
      displayLabel: "Glycemic Index",
      aliases: ["GI", "Glycaemic index"],
      domainId: "therapeutics-multidisciplinary",
      summary:
        "Ranking of carbohydrate-containing foods by the rapidity and magnitude of their postprandial blood glucose excursion.",
    },
    {
      id: "gtt",
      verbatimLabel: "GTT",
      displayLabel: "GTT",
      aliases: ["OGTT", "Oral glucose tolerance test", "Glucose tolerance test"],
      domainId: "diagnostics-monitoring",
      summary:
        "Oral Glucose Tolerance Test measuring plasma glucose 2 hours after a 75g oral glucose load (>=200 mg/dL diagnostic).",
    },
    {
      id: "hba1c",
      verbatimLabel: "HbA1c",
      displayLabel: "HbA1c",
      aliases: ["Glycated hemoglobin", "Hemoglobin A1c", "A1c"],
      domainId: "diagnostics-monitoring",
      summary:
        "Glycated hemoglobin fraction reflecting integrated mean blood glucose exposure over the lifespan of red blood cells (8-12 weeks).",
    },
    {
      id: "hhs",
      verbatimLabel: "HHS",
      displayLabel: "HHS",
      aliases: [
        "Hyperosmolar hyperglycemic state",
        "HONK",
      ],
      domainId: "acute-crises",
      summary:
        "Hyperosmolar Hyperglycemic State characterized by extreme hyperglycemia, severe dehydration, and hyperosmolality without significant ketosis.",
    },
    {
      id: "hypertension",
      verbatimLabel: "Hypertension",
      displayLabel: "Hypertension",
      aliases: ["High blood pressure", "HTN"],
      domainId: "complications-risk-factors",
      summary:
        "Common vascular comorbidity in diabetes that accelerates both macrovascular atherosclerotic disease and microvascular nephropathy/retinopathy.",
    },
    {
      id: "hyperglycaemia",
      verbatimLabel: "Hyperglycaemia",
      displayLabel: "Hyperglycaemia",
      aliases: ["Hyperglycemia", "Hyper-glycemia"],
      domainId: "signs-symptoms",
      summary:
        "Elevated circulating blood glucose resulting from defective insulin secretion, impaired insulin action, or both.",
    },
    {
      id: "hypo-glycemia",
      verbatimLabel: "Hypo-glycemia",
      displayLabel: "Hypoglycemia",
      aliases: ["Hypoglycemia", "Hypoglycaemia"],
      domainId: "acute-crises",
      summary:
        "Acute drop in plasma glucose (<70 mg/dL) causing adrenergic and neuroglycopenic symptoms, frequently iatrogenic from insulin or sulfonylureas.",
    },
    {
      id: "insulin",
      verbatimLabel: "Insulin",
      displayLabel: "Insulin",
      aliases: [],
      domainId: "anatomy-pathophysiology",
      summary:
        "Peptide hormone produced by pancreatic beta cells that promotes GLUT4-mediated glucose uptake and suppresses hepatic glucose production and lipolysis.",
    },
    {
      id: "islet-cells",
      verbatimLabel: "Islet Cells",
      displayLabel: "Islet Cells",
      aliases: ["Islets of Langerhans", "Islet cell"],
      domainId: "anatomy-pathophysiology",
      summary:
        "Endocrine micro-organs within the pancreas containing alpha, beta, delta, and PP cells that coordinate metabolic homeostasis.",
    },
    {
      id: "keto-acidosis",
      verbatimLabel: "Keto-acidosis",
      displayLabel: "Ketoacidosis",
      aliases: ["Ketoacidosis", "DKA", "Diabetic ketoacidosis"],
      domainId: "acute-crises",
      summary:
        "Diabetic Ketoacidosis: acute emergency driven by absolute insulin deficiency and counter-regulatory hormone excess causing ketonemia and anion-gap acidosis.",
    },
    {
      id: "lada",
      verbatimLabel: "LADA",
      displayLabel: "LADA",
      aliases: ["Latent autoimmune diabetes in adults"],
      domainId: "subtypes-genetics",
      summary:
        "Latent Autoimmune Diabetes in Adults: slowly progressive autoimmune beta-cell destruction presenting in adulthood.",
    },
    {
      id: "lipo-hypertrophy",
      verbatimLabel: "Lipo-hypertrophy",
      displayLabel: "Lipohypertrophy",
      aliases: ["Lipohypertrophy", "lipodistrophy", "Lipodystrophy"],
      domainId: "complications-risk-factors",
      summary:
        "Subcutaneous fibrofatty nodule at sites of repeated insulin injection due to local lipogenic effect of insulin, causing erratic absorption.",
    },
    {
      id: "metformin",
      verbatimLabel: "Metformin",
      displayLabel: "Metformin",
      aliases: ["Biguanide"],
      domainId: "therapeutics-multidisciplinary",
      summary:
        "First-line oral biguanide that inhibits hepatic gluconeogenesis via AMPK activation and improves peripheral insulin sensitivity.",
    },
    {
      id: "microalbuminuria",
      verbatimLabel: "Microalbuminuria",
      displayLabel: "Microalbuminuria",
      aliases: ["Micro-albuminuria", "Microalbumin"],
      domainId: "complications-risk-factors",
      summary:
        "Moderately increased urinary albumin excretion (30-300 mg/day) serving as the earliest clinical marker of incipient diabetic nephropathy.",
    },
    {
      id: "mody",
      verbatimLabel: "MODY",
      displayLabel: "MODY",
      aliases: ["Maturity-onset diabetes of the young"],
      domainId: "subtypes-genetics",
      summary:
        "Maturity-Onset Diabetes of the Young: autosomal dominant monogenic beta-cell dysfunction presenting before age 25 without autoantibodies.",
    },
    {
      id: "neuropathy",
      verbatimLabel: "Neuropathy",
      displayLabel: "Neuropathy",
      aliases: ["Diabetic neuropathy", "Peripheral neuropathy"],
      domainId: "complications-risk-factors",
      summary:
        "Microvascular axonal and Schwann cell nerve injury causing distal symmetric sensory loss and autonomic dysfunction.",
    },
    {
      id: "pancreas",
      verbatimLabel: "Pancreas",
      displayLabel: "Pancreas",
      aliases: [],
      domainId: "anatomy-pathophysiology",
      summary:
        "Retroperitoneal organ housing both exocrine acinar tissue and endocrine islets of Langerhans.",
    },
    {
      id: "podiatrist",
      verbatimLabel: "Podiatrist",
      displayLabel: "Podiatrist",
      aliases: ["Podiatry", "Foot care specialist"],
      domainId: "therapeutics-multidisciplinary",
      summary:
        "Multidisciplinary foot-care specialist preventing and managing diabetic foot ulcers, callus debridement, and lower-extremity amputation risk.",
    },
    {
      id: "polydipsia",
      verbatimLabel: "Polydipsia",
      displayLabel: "Polydipsia",
      aliases: [],
      domainId: "signs-symptoms",
      summary:
        "Excessive thirst driven by hypothalamic osmoreceptor activation secondary to hyperosmolar osmotic diuresis.",
    },
    {
      id: "polyphagia",
      verbatimLabel: "Polyphagia",
      displayLabel: "Polyphagia",
      aliases: [],
      domainId: "signs-symptoms",
      summary:
        "Hyperphagia and persistent hunger caused by intracellular glucose starvation and hypothalamic signaling in insulin deficiency.",
    },
    {
      id: "polyuria",
      verbatimLabel: "Polyuria",
      displayLabel: "Polyuria",
      aliases: [],
      domainId: "signs-symptoms",
      summary:
        "Osmotic diuresis resulting when filtered glucose in renal tubules draws water into the urine.",
    },
    {
      id: "pregnancy",
      verbatimLabel: "Pregnancy",
      displayLabel: "Pregnancy",
      aliases: ["Gestational diabetes", "GDM"],
      domainId: "subtypes-genetics",
      summary:
        "Physiologic insulin-resistant state caused by placental hormones that can unmask gestational diabetes mellitus.",
    },
    {
      id: "retinopathy",
      verbatimLabel: "Retinopathy",
      displayLabel: "Retinopathy",
      aliases: ["Diabetic retinopathy"],
      domainId: "complications-risk-factors",
      summary:
        "Microvascular retinal disease progressing from microaneurysms and hemorrhages to proliferative neovascularization and vision loss.",
    },
    {
      id: "screening",
      verbatimLabel: "Screening",
      displayLabel: "Screening",
      aliases: [],
      domainId: "diagnostics-monitoring",
      summary:
        "Systematic evaluation of asymptomatic at-risk individuals for early detection of diabetes and microvascular complications.",
    },
    {
      id: "smoking",
      verbatimLabel: "Smoking",
      displayLabel: "Smoking",
      aliases: ["Tobacco"],
      domainId: "complications-risk-factors",
      summary:
        "Modifiable behavioral risk factor that synergistically accelerates endothelial injury, nephropathy, and cardiovascular mortality in diabetes.",
    },
    {
      id: "sulfonyl-ureas",
      verbatimLabel: "Sulfonyl-ureas",
      displayLabel: "Sulfonylureas",
      aliases: ["Sulfonylureas", "Sulfonylurea", "SU"],
      domainId: "therapeutics-multidisciplinary",
      summary:
        "Class of oral insulin secretagogues that bind SUR1 subunits on beta-cell K-ATP channels to trigger endogenous insulin release.",
    },
    {
      id: "thiazolidine-diones",
      verbatimLabel: "Thiazolidine-diones",
      displayLabel: "Thiazolidinediones",
      aliases: ["Thiazolidinediones", "TZDs", "Pioglitazone"],
      domainId: "therapeutics-multidisciplinary",
      summary:
        "PPAR-gamma nuclear receptor agonists that enhance peripheral insulin sensitivity in adipose tissue and skeletal muscle.",
    },
    {
      id: "transplant",
      verbatimLabel: "Transplant",
      displayLabel: "Transplant",
      aliases: ["Pancreas transplant", "Islet transplant"],
      domainId: "therapeutics-multidisciplinary",
      summary:
        "Whole-pancreas or isolated islet cell transplantation used to restore endogenous euglycemia in severe labile Type 1 DM.",
    },
    {
      id: "ulcer",
      verbatimLabel: "Ulcer",
      displayLabel: "Ulcer",
      aliases: ["Diabetic foot ulcer", "Foot ulcer"],
      domainId: "complications-risk-factors",
      summary:
        "Chronic lower-extremity cutaneous wound resulting from peripheral neuropathy, repetitive plantar trauma, and peripheral arterial ischemia.",
    },
    {
      id: "venous",
      verbatimLabel: "Venous",
      displayLabel: "Venous",
      aliases: ["Venous plasma"],
      domainId: "diagnostics-monitoring",
      summary:
        "Laboratory venous plasma blood draw required to confirm formal diagnostic thresholds for fasting glucose and GTT.",
    },
    {
      id: "weight",
      verbatimLabel: "Weight",
      displayLabel: "Weight",
      aliases: ["Overweight", "Obesity", "BMI"],
      domainId: "complications-risk-factors",
      summary:
        "Excess visceral adiposity and body mass index driving chronic low-grade inflammation, free fatty acid flux, and peripheral insulin resistance.",
    },
    {
      id: "weight-loss",
      verbatimLabel: "Weight loss",
      displayLabel: "Weight Loss",
      aliases: [],
      domainId: "signs-symptoms",
      summary:
        "Dual clinical concept: unintentional catabolic weight loss in insulin-deficient T1DM, and intentional therapeutic weight reduction in T2DM.",
    },
  ],
  adjudicationRubric: {
    evaluatorPersona:
      "Board-Certified Endocrinologist and Medical School Professor",
    subjectDomain:
      "Undergraduate Preclinical Diabetes Mellitus Pathophysiology, Diagnosis, and Management",
    chainContinuityCriteria: [
      "Every consecutive pair of keywords (C_i -> C_{i+1}) must be linked by an accurate pathophysiological, diagnostic, pharmacological, epidemiological, or clinical management mechanism.",
      "The narrative must articulate how each concept causes, diagnoses, monitors, treats, or complicates the next concept in sequence rather than merely listing definitions.",
      "Clinical assertions must align with established undergraduate medical endocrinology principles.",
    ],
    calibrationBoardCardIds: [
      [
        "retinopathy",
        "pancreas",
        "ulcer",
        "sulfonyl-ureas",
        "metformin",
        "beta-cells",
        "diet",
      ],
      [
        "autoimmune",
        "glycemic-index",
        "hypo-glycemia",
        "weight-loss",
        "adiponectin",
        "glucose",
        "hyperglycaemia",
      ],
      [
        "islet-cells",
        "transplant",
        "hhs",
        "amylin",
        "thiazolidine-diones",
        "podiatrist",
        "polyphagia",
      ],
      [
        "ace-inhibitors",
        "screening",
        "microalbuminuria",
        "smoking",
        "genetic",
        "fasting",
        "gtt",
      ],
      [
        "glucagon",
        "neuropathy",
        "dys-lipidaemia",
        "insulin",
        "weight",
        "polyuria",
        "glucometer",
      ],
      [
        "polydipsia",
        "gastro-paresis",
        "c-peptide",
        "venous",
        "keto-acidosis",
        "glucosuria",
        "hypertension",
      ],
      [
        "mody",
        "lipo-hypertrophy",
        "children",
        "pregnancy",
        "lada",
        "glipizide",
        "hba1c",
      ],
    ],
    calibrationExamples: [
      {
        id: "fig2-chain-a",
        title: "Figure 2 Valid Chain A (9 Keywords)",
        path: [
          { row: 3, col: 4 },
          { row: 3, col: 3 },
          { row: 4, col: 4 },
          { row: 4, col: 3 },
          { row: 3, col: 2 },
          { row: 3, col: 1 },
          { row: 4, col: 1 },
          { row: 5, col: 1 },
          { row: 6, col: 1 },
        ],
        keywordIds: [
          "genetic",
          "smoking",
          "weight",
          "insulin",
          "microalbuminuria",
          "screening",
          "neuropathy",
          "gastro-paresis",
          "lipo-hypertrophy",
        ],
        narrativeExplanation:
          "Genetics, smoking, and excess weight predispose individuals to insulin resistance/deficiency, which can lead to microalbuminuria requiring regular screening, or else patients develop chronic complications such as neuropathy, gastroparesis, and injection-related lipohypertrophy.",
        isValid: true,
        invalidReason: null,
      },
      {
        id: "fig2-chain-b",
        title: "Figure 2 Valid Chain B (7 Keywords)",
        path: [
          { row: 2, col: 6 },
          { row: 1, col: 6 },
          { row: 0, col: 5 },
          { row: 1, col: 5 },
          { row: 0, col: 4 },
          { row: 0, col: 3 },
          { row: 1, col: 3 },
        ],
        keywordIds: [
          "polyphagia",
          "hyperglycaemia",
          "beta-cells",
          "glucose",
          "metformin",
          "sulfonyl-ureas",
          "weight-loss",
        ],
        narrativeExplanation:
          "Polyphagia and hyperglycaemia are classic manifestations resulting from pancreatic beta-cell dysfunction that impairs blood glucose regulation, which is managed clinically with oral agents such as metformin and sulfonylureas alongside lifestyle weight loss.",
        isValid: true,
        invalidReason: null,
      },
      {
        id: "fig2-chain-c",
        title: "Figure 2 Invalid Chain C (Broken Adjacency)",
        path: [
          { row: 1, col: 0 },
          { row: 2, col: 0 },
          { row: 0, col: 1 },
          { row: 0, col: 0 },
        ],
        keywordIds: ["autoimmune", "islet-cells", "pancreas", "retinopathy"],
        narrativeExplanation:
          "Autoimmune destruction of islet cells in the pancreas causes diabetes mellitus, which leads to microvascular complications such as retinopathy.",
        isValid: false,
        invalidReason:
          "As the keywords 'Pancreas' (row 0, col 1) and 'Islet Cells' (row 2, col 0) do not touch each other horizontally or diagonally on the grid, the chain is invalid.",
      },
    ],
  },
  assessmentInstrument: {
    questions: [
      {
        id: "dm-mcq-01",
        bloomLevel: 2,
        stem: "Why does serum C-peptide measurement remain clinically useful in differentiating endogenous insulin production from surreptitious exogenous insulin administration?",
        options: [
          "C-peptide is cleaved from proinsulin in equimolar amounts to endogenous insulin and is absent from commercial insulin preparations.",
          "C-peptide directly stimulates hepatic glycogenolysis when exogenous insulin levels rise.",
          "Exogenous insulin is rapidly converted into C-peptide by renal tubular cells.",
          "C-peptide binds to GLUT4 transporters to inhibit peripheral glucose uptake.",
        ],
        correctIndex: 0,
        relatedKeywordIds: ["c-peptide", "insulin", "beta-cells", "pancreas"],
        explanation:
          "Pancreatic beta cells cleave proinsulin into equimolar amounts of insulin and C-peptide; pharmaceutical insulin preparations contain no C-peptide.",
      },
      {
        id: "dm-mcq-02",
        bloomLevel: 3,
        stem: "An overweight 48-year-old patient with newly diagnosed Type 2 Diabetes Mellitus is started on first-line oral pharmacotherapy that activates hepatic AMPK and suppresses gluconeogenesis without causing weight gain or hypoglycemia. Which agent was prescribed?",
        options: [
          "Glipizide",
          "Metformin",
          "Pioglitazone (Thiazolidinedione)",
          "Exogenous Basal Insulin",
        ],
        correctIndex: 1,
        relatedKeywordIds: [
          "metformin",
          "glucose",
          "insulin",
          "weight-loss",
        ],
        explanation:
          "Metformin is a biguanide that activates hepatic AMPK, reduces hepatic gluconeogenesis, enhances peripheral insulin sensitivity, and does not stimulate endogenous insulin secretion.",
      },
      {
        id: "dm-mcq-03",
        bloomLevel: 2,
        stem: "What is the primary pathophysiological mechanism linking severe hyperglycaemia to polyuria and polydipsia in untreated diabetes mellitus?",
        options: [
          "Autoimmune destruction of the posterior pituitary suppressing antidiuretic hormone release.",
          "Filtered plasma glucose exceeding the proximal renal tubular transport maximum, causing glucosuria and osmotic diuresis.",
          "Direct vagus nerve stimulation of the detrusor muscle via gastroparesis pathways.",
          "Excessive adiponectin secretion increasing glomerular filtration pressure.",
        ],
        correctIndex: 1,
        relatedKeywordIds: [
          "hyperglycaemia",
          "glucosuria",
          "polyuria",
          "polydipsia",
        ],
        explanation:
          "When plasma glucose exceeds the renal threshold (~180 mg/dL), unresorbed glucose remains in the renal filtrate (glucosuria), drawing water osmotically (polyuria) and triggering hypothalamic thirst (polydipsia).",
      },
      {
        id: "dm-mcq-04",
        bloomLevel: 3,
        stem: "A patient treated with sulfonylureas (glipizide) skips a meal and develops diaphoresis, tremor, and confusion with a capillary glucometer reading of 48 mg/dL. How did the drug precipitate this acute crisis?",
        options: [
          "By closing ATP-sensitive potassium channels on pancreatic beta cells, triggering glucose-independent insulin release.",
          "By inhibiting intestinal alpha-glucosidase brush-border enzymes.",
          "By activating PPAR-gamma nuclear receptors in subcutaneous adipocytes.",
          "By blocking renal SGLT2 glucose reabsorption in the proximal tubule.",
        ],
        correctIndex: 0,
        relatedKeywordIds: [
          "sulfonyl-ureas",
          "glipizide",
          "beta-cells",
          "insulin",
          "hypo-glycemia",
          "glucometer",
        ],
        explanation:
          "Sulfonylureas bind SUR1 subunits on beta-cell K-ATP channels to depolarize the cell and stimulate insulin secretion regardless of ambient blood glucose, predisposing to hypoglycemia.",
      },
      {
        id: "dm-mcq-05",
        bloomLevel: 2,
        stem: "Why are ACE inhibitors specifically indicated in a diabetic patient whose annual screening reveals persistent microalbuminuria?",
        options: [
          "They dilate efferent glomerular arterioles, reducing intraglomerular hypertension and slowing progression of diabetic nephropathy.",
          "They regenerate pancreatic islet beta cells to normalize endogenous amylin output.",
          "They block counter-regulatory glucagon secretion from pancreatic alpha cells.",
          "They prevent subcutaneous lipohypertrophy at insulin injection sites.",
        ],
        correctIndex: 0,
        relatedKeywordIds: [
          "ace-inhibitors",
          "microalbuminuria",
          "screening",
          "hypertension",
        ],
        explanation:
          "ACE inhibitors block angiotensin II-mediated efferent arteriolar constriction, lowering intraglomerular pressure and reducing urinary albumin excretion.",
      },
      {
        id: "dm-mcq-06",
        bloomLevel: 2,
        stem: "Which clinical feature best distinguishes Hyperosmolar Hyperglycemic State (HHS) from Diabetic Ketoacidosis (DKA)?",
        options: [
          "Residual endogenous insulin secretion in HHS is sufficient to suppress lipolysis and ketogenesis but insufficient to prevent severe hyperglycaemia and osmotic dehydration.",
          "HHS occurs exclusively in young children with autoimmune Type 1 diabetes.",
          "DKA is characterized by complete absence of glucosuria and normal venous blood pH.",
          "HHS is caused by excessive exogenous insulin administration at lipohypertrophic sites.",
        ],
        correctIndex: 0,
        relatedKeywordIds: [
          "hhs",
          "keto-acidosis",
          "insulin",
          "hyperglycaemia",
        ],
        explanation:
          "In HHS (typically T2DM), low but present portal insulin inhibits hormone-sensitive lipase and ketogenesis while failing to control hepatic glucose output, leading to extreme hyperglycemia without ketoacidosis.",
      },
      {
        id: "dm-mcq-07",
        bloomLevel: 3,
        stem: "A non-obese 19-year-old presents with mild fasting hyperglycaemia, negative islet autoantibodies, a three-generation family history of early-onset diabetes, and preserved C-peptide. Which subtype is most likely?",
        options: [
          "MODY (Maturity-Onset Diabetes of the Young)",
          "LADA (Latent Autoimmune Diabetes in Adults)",
          "Gestational Diabetes Mellitus",
          "Fulminant Type 1 Autoimmune Diabetes",
        ],
        correctIndex: 0,
        relatedKeywordIds: [
          "mody",
          "genetic",
          "fasting",
          "hyperglycaemia",
          "c-peptide",
        ],
        explanation:
          "MODY is an autosomal dominant monogenic defect in beta-cell function presenting in youth/young adulthood without autoantibodies or obesity.",
      },
      {
        id: "dm-mcq-08",
        bloomLevel: 3,
        stem: "A patient with long-standing poorly controlled diabetes consistently injects insulin into the same periumbilical spot and develops a firm subcutaneous fibrofatty nodule. How does this complication affect glycemic control?",
        options: [
          "Lipohypertrophy causes erratic, delayed insulin absorption, leading to unpredictable swings between hyperglycaemia and hypoglycaemia.",
          "It accelerates hepatic clearance of HbA1c, falsely lowering laboratory values.",
          "It induces autoimmune antibodies against glucagon-producing alpha cells.",
          "It directly causes vagal nerve denervation and gastroparesis.",
        ],
        correctIndex: 0,
        relatedKeywordIds: [
          "lipo-hypertrophy",
          "insulin",
          "hyperglycaemia",
          "hypo-glycemia",
        ],
        explanation:
          "Repeated insulin injections at the same site stimulate local lipogenesis (lipohypertrophy); injecting into avascular scar/fatty tissue leads to erratic insulin absorption.",
      },
      {
        id: "dm-mcq-09",
        bloomLevel: 2,
        stem: "How does diabetic autonomic and peripheral neuropathy interact with vascular risk factors like smoking and dyslipidaemia to predispose patients to diabetic foot ulcers?",
        options: [
          "Loss of protective plantar pain sensation combined with microvascular/macrovascular ischemia allows repetitive mechanical trauma to progress into chronic non-healing ulcers.",
          "Neuropathy increases pain sensitivity in the foot, causing patients to avoid weight-bearing and develop disuse ulcers.",
          "Smoking increases adiponectin release, which dissolves plantar subcutaneous fat pads.",
          "Dyslipidaemia causes acute hypoglycemic vasospasm exclusively in the great toe.",
        ],
        correctIndex: 0,
        relatedKeywordIds: [
          "neuropathy",
          "smoking",
          "dys-lipidaemia",
          "ulcer",
          "podiatrist",
        ],
        explanation:
          "Distal symmetric polyneuropathy removes protective sensation while smoking and dyslipidemia worsen peripheral arterial disease, necessitating multidisciplinary podiatric care.",
      },
      {
        id: "dm-mcq-10",
        bloomLevel: 2,
        stem: "Why is a venous HbA1c assay able to reflect chronic glycemic control over the preceding 8 to 12 weeks without requiring an 8-hour fast?",
        options: [
          "Glucose undergoes slow, non-enzymatic irreversible glycation of hemoglobin A proportional to ambient plasma glucose across the ~120-day lifespan of erythrocytes.",
          "HbA1c measures the acute postprandial spike in pancreatic amylin secretion after a 75g oral glucose load.",
          "Hemoglobin is synthesized exclusively during fasting states in the retroperitoneal pancreas.",
          "Capillary glucometers store 90 days of venous plasma samples internally.",
        ],
        correctIndex: 0,
        relatedKeywordIds: ["hba1c", "venous", "glucose", "fasting", "gtt"],
        explanation:
          "Non-enzymatic glycation of hemoglobin in red blood cells occurs continuously over their ~120-day lifespan, making HbA1c independent of acute fasting status.",
      },
    ],
  },
  perceptionSurvey: {
    items: [
      {
        id: "survey-q1",
        prompt:
          "The rules of the game were easy to understand and simple to follow.",
      },
      {
        id: "survey-q2",
        prompt: 'I enjoyed playing the "Diabe-teach" game.',
      },
      {
        id: "survey-q3",
        prompt:
          "The game facilitated a deeper comprehension of the material compared to traditional study methods.",
      },
      {
        id: "survey-q4",
        prompt:
          "The game encouraged me to communicate my ideas clearly with peers.",
      },
      {
        id: "survey-q5",
        prompt:
          "I felt more confident in discussing complex concepts after playing the game.",
      },
      {
        id: "survey-q6",
        prompt:
          "I improved my ability to correlate different pieces of information through gameplay.",
      },
      {
        id: "survey-q7",
        prompt:
          "I felt less stressed while learning through the game compared to traditional methods.",
      },
      {
        id: "survey-q8",
        prompt:
          "I preferred the game over traditional learning activities for understanding complex topics.",
      },
      {
        id: "survey-q9",
        prompt: "I would recommend using this game for future classes.",
      },
    ],
  },
});
