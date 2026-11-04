/** English copy. The source for Telugu and Hindi. No em dashes, no alarming words. */
export const en = {
  common: {
    textSize: "Change text size",
    language: "Language",
    callLab: "Call the lab",
    callMeBack: "Call me back",
    honorific: "garu",
    back: "Back",
    next: "Next",
    signOut: "Sign out",
    signedBy: "the front desk",
  },
  signIn: {
    title: "Your file at the lab.",
    lede: "Every report we make for you is kept here, page by page.",
    phoneLabel: "Your mobile number",
    phonePlaceholder: "10-digit number",
    phoneHint: "The one you gave at the lab counter.",
    send: "Send me a code",
    sending: "Sending your code",
    safe: "No password to remember. Only this number opens your file, and we write down every time it is opened.",
    badPhone: "Please type the 10-digit mobile number you gave at the lab.",
    locked: "This number is paused for a little while. Please try again at {time}, or call us.",
    dailyCap: "We have sent the most codes we can for today. Please call us and we will help.",
  },
};

export type Messages = typeof en;
