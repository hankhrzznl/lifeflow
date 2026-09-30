import { redirect } from "next/navigation";

// T15b：体态拉伸已并入「训练中心」（/more/fitness?tab=posture），保留路由兼容重定向
export default function PosturePage() {
  redirect("/more/fitness?tab=posture");
}
