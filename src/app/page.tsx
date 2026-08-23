import { headers } from "next/headers";
import { getChurchAccess } from "@/infrastructure/auth/church-session";
import { HomeContent } from "./home-content";

export default async function Home() {
  const access = await getChurchAccess(await headers());
  return <HomeContent isLoggedIn={access.status === "authorized"} />;
}
