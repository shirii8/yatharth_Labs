import type { PartialMessages } from "./index";

/**
 * Hindi. From the design handoff; needs native-speaker review before go-live.
 * Keys not here fall back to English.
 */
export const hi: PartialMessages = {
  nav: {
    home: "होम",
    menu: "मेनू",
    close: "बंद करें",
    settings: "सेटिंग्स",
  },
  common: {
    textSize: "अक्षर का आकार बदलें",
    easyView: "आसान दृश्य",
    language: "भाषा",
    callLab: "लैब को कॉल करें",
    callMeBack: "मुझे वापस कॉल करें",
    honorific: "जी",
    back: "पीछे",
    next: "आगे",
  },
  signIn: {
    title: "लैब में आपकी फ़ाइल।",
    lede: "आपकी हर रिपोर्ट यहाँ, पन्ना-पन्ना रखी जाती है।",
    phoneLabel: "आपका मोबाइल नंबर",
    phonePlaceholder: "10 अंकों का नंबर",
    phoneHint: "जो लैब काउंटर पर दिया था।",
    send: "मुझे कोड भेजें",
    safe: "कोई पासवर्ड नहीं। आपकी फ़ाइल सिर्फ़ इसी नंबर पर खुलती है, और हर बार खुलने पर हम दर्ज करते हैं।",
  },
  report: {
    compact: "कॉम्पैक्ट",
    titleFor: "आपकी {test} रिपोर्ट आ गई है।",
    listen: "मेरी रिपोर्ट सुनाइए",
    stop: "रोकें",
    resultOf: "नतीजा {n} / {count}",
    prev: "पीछे",
    next: "अगला नतीजा",
    last: "आगे क्या करें",
    nextHead: "आगे क्या करें",
    you: "आप",
    print: "छापने लायक प्रति",
    full: "हस्ताक्षरित पूरी रिपोर्ट",
    flag: "कुछ गलत लग रहा है? बताइए",
    ledgerLink: "सारे रिकॉर्ड",
  },
};
