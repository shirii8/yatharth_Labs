"use client";

import { useEffect, useState } from "react";
import uiStyles from "@/components/ui/ui.module.css";

const VOICE_LANG: Record<string, string> = { en: "en-IN", te: "te-IN", hi: "hi-IN" };

/**
 * "Read it aloud to me", using the phone's own voice (speechSynthesis): nothing
 * is sent anywhere. Hidden when the phone has no voice for the language, so the
 * button never does nothing.
 */
export function ListenButton({
  text,
  locale,
  label,
  stopLabel,
}: {
  text: string;
  locale: string;
  label: string;
  stopLabel: string;
}) {
  const [voice, setVoice] = useState<SpeechSynthesisVoice | null>(null);
  const [speaking, setSpeaking] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    const want = VOICE_LANG[locale] ?? "en-IN";
    const pick = () => {
      const voices = window.speechSynthesis.getVoices();
      setVoice(
        voices.find((v) => v.lang === want) ??
          voices.find((v) => v.lang.startsWith(want.slice(0, 2))) ??
          null,
      );
    };
    pick();
    window.speechSynthesis.addEventListener("voiceschanged", pick);
    return () => {
      window.speechSynthesis.removeEventListener("voiceschanged", pick);
      window.speechSynthesis.cancel();
    };
  }, [locale]);

  if (!voice) return null;

  function toggle() {
    if (speaking) {
      window.speechSynthesis.cancel();
      setSpeaking(false);
      return;
    }
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.voice = voice;
    utterance.lang = voice!.lang;
    utterance.rate = 0.9;
    utterance.onend = () => setSpeaking(false);
    window.speechSynthesis.speak(utterance);
    setSpeaking(true);
  }

  return (
    <button type="button" className={uiStyles.outline} onClick={toggle} aria-pressed={speaking}>
      <svg
        aria-hidden="true"
        width="22"
        height="22"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      >
        <path d="M4 9v6h4l5 4V5L8 9z" />
        <path d="M16 9q2 3 0 6M19 7q4 5 0 10" />
      </svg>
      {speaking ? stopLabel : label}
    </button>
  );
}
