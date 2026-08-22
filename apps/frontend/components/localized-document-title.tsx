"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

import { useI18n } from "@/lib/i18n";

export function LocalizedDocumentTitle(): null {
  const pathname = usePathname();
  const { t } = useI18n();

  useEffect(() => {
    const title = t("app.title");
    const applyTitle = (): void => {
      if (document.title !== title) document.title = title;
    };
    applyTitle();
    const observer = new MutationObserver(applyTitle);
    observer.observe(document.head, {
      childList: true,
      characterData: true,
      subtree: true,
    });
    return () => observer.disconnect();
  }, [pathname, t]);

  return null;
}
