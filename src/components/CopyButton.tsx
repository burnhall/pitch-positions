"use client";

import { useState } from "react";
import { Button } from "./ui";

export function CopyButton({ text, label = "Copy link" }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <Button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        } catch {
          prompt("Copy this link:", text);
        }
      }}
    >
      {copied ? "Copied ✓" : label}
    </Button>
  );
}
