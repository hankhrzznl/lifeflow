"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function HealthHubPage() {
  const router = useRouter();
  useEffect(() => { router.replace("/overview"); }, [router]);
  return null;
}
