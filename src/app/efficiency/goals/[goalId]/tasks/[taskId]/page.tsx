"use client";

import { useEffect } from "react";
import { useRouter, useParams } from "next/navigation";

export default function TaskDetailRedirect() {
  const router = useRouter();
  const params = useParams();
  const goalId = params.goalId as string;

  useEffect(() => {
    router.replace(`/efficiency/goals/${goalId}`);
  }, [router, goalId]);

  return null;
}
