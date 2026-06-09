"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function LearningHubPage() {
  const router = useRouter();
  useEffect(() => { router.replace("/overview"); }, [router]);
  return null;
}
