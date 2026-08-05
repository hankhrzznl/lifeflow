import { redirect } from "next/navigation";

// T15b：功法养生已并入「训练中心」（/more/fitness?tab=wellness），保留路由兼容重定向
export default function WellnessPage() {
  redirect("/more/fitness?tab=wellness");
}
