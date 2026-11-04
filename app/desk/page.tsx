import { redirect } from "next/navigation";

/** The desk opens on patient search. */
export default function DeskHome() {
  redirect("/desk/patients");
}
