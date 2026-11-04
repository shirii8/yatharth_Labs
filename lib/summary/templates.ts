/**
 * The locked wording. Rules choose a key; the template supplies the words; only
 * rules fill the {placeholders}. Nothing else ever reaches a patient as a
 * sentence about their results. These are seeded into SummaryTemplate, where
 * the lab can version and approve them.
 *
 * English is from the design handoff and the lab's style rules (DESIGN.md 8).
 * Telugu and Hindi come from the design handoff and still need native review.
 */

export type TemplateLanguage = "EN" | "TE" | "HI";

const EN: Record<string, string> = {
  "intro.all_usual": "All {count} results are in the usual range.",
  "intro.count": "Of {count} results, {usual} are in the usual range.",
  "intro.none_usual": "None of the {count} results are in the usual range.",
  "intro.one_usual": "This result is in the usual range.",
  "flag.low.mild": "{analyte} is a little low.",
  "flag.low.marked": "{analyte} is much lower than usual.",
  "flag.high.mild": "{analyte} is a little high.",
  "flag.high.marked": "{analyte} is much higher than usual.",
  "word.low.mild": "A little low.",
  "word.low.marked": "Much lower than usual.",
  "word.high.mild": "A little high.",
  "word.high.marked": "Much higher than usual.",
  "word.usual": "In the usual range.",
  "sentence.flagged": "Your doctor will tell you whether anything needs to be done.",
  "sentence.usual": "Nothing to do here.",
  "rule.low":
    "Marked by the lab's rule: below {low}, the lower end of the range printed on your signed report.",
  "rule.high":
    "Marked by the lab's rule: above {high}, the upper end of the range printed on your signed report.",
  "rule.usual": "Checked by the lab's rule against the range printed on your signed report.",
  "next.flagged.1": "Show this page to your doctor at your next visit. No need to rush.",
  "next.usual.1": "Keep this page for your next visit to your doctor.",
  "next.any.call": 'Questions? Tap "Call me back" and one of us will ring you.',
  "test.CBC.next": "Very tired or short of breath? Call your doctor sooner.",
  "test.ELEC.next": "Feeling very weak or dizzy? Call your doctor sooner.",
  "trend.change": "{analyte} was {before} on {date}. This time it is {now}.",
  footer:
    "These words come from the lab's checked wording for this test. Low and usual come from the ranges printed on your signed report. Your doctor's advice comes first.",
  "critical.safety.head": "Go to the nearest hospital emergency now if any of these happen:",
  "critical.safety.items":
    "Chest pain|A fast or uneven heartbeat|Sudden weakness in the arms or legs|Trouble breathing",
};

const TE: Record<string, string> = {
  "word.low.mild": "కొంచెం తక్కువ.",
  "word.usual": "సాధారణ పరిధిలో ఉంది.",
  "sentence.flagged": "ఏమైనా చేయాలా అని మీ డాక్టర్ చెబుతారు.",
  "sentence.usual": "ఇక్కడ చేయవలసింది ఏమీ లేదు.",
  "rule.low":
    "ల్యాబ్ నియమం ప్రకారం గుర్తించబడింది: మీ రిపోర్టులోని పరిధి కనిష్ఠం {low} కంటే తక్కువ.",
  "rule.usual": "మీ రిపోర్టులో ముద్రించిన పరిధితో ల్యాబ్ నియమం ద్వారా సరిచూడబడింది.",
  "next.flagged.1": "తదుపరి డాక్టర్ సందర్శనలో ఈ పేజీ చూపించండి.",
  "test.CBC.next": "చాలా అలసట లేదా ఆయాసం ఉంటే, త్వరగా డాక్టర్‌కు కాల్ చేయండి.",
  "next.any.call": 'ప్రశ్నలు ఉంటే "నాకు తిరిగి కాల్ చేయండి" నొక్కండి.',
  "critical.safety.head":
    "వీటిలో ఏదైనా ఉంటే, వెంటనే దగ్గరలోని ఆసుపత్రి అత్యవసర విభాగానికి వెళ్ళండి:",
  "critical.safety.items":
    "ఛాతీ నొప్పి|వేగంగా లేదా అసమానంగా గుండె కొట్టుకోవడం|చేతులు లేదా కాళ్ళలో అకస్మాత్తుగా బలహీనత|శ్వాస తీసుకోవడంలో ఇబ్బంది",
};

const HI: Record<string, string> = {
  "word.low.mild": "थोड़ा कम।",
  "word.usual": "सामान्य दायरे में।",
  "sentence.flagged": "कुछ करने की ज़रूरत है या नहीं, यह आपके डॉक्टर बताएँगे।",
  "sentence.usual": "यहाँ कुछ करने की ज़रूरत नहीं।",
  "rule.low": "लैब के नियम से चिह्नित: आपकी रिपोर्ट में छपे दायरे के निचले सिरे {low} से कम।",
  "rule.usual": "आपकी रिपोर्ट में छपे दायरे से लैब के नियम द्वारा जाँचा गया।",
  "next.flagged.1": "अगली बार डॉक्टर से मिलें तो यह पन्ना दिखाएँ।",
  "test.CBC.next": "बहुत थकान या साँस फूलने पर जल्दी डॉक्टर को फ़ोन करें।",
  "next.any.call": 'कोई सवाल हो तो "मुझे वापस कॉल करें" दबाएँ।',
};

export const DEFAULT_TEMPLATES: Record<TemplateLanguage, Record<string, string>> = { EN, TE, HI };

/** Keys whose wording a lab doctor must approve before go-live. */
export const NEEDS_DOCTOR_APPROVAL = new Set(["critical.safety.head", "critical.safety.items"]);
