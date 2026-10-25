import type { Metadata } from "next";
import { LegalPage } from "@/components/legal-page";
import { getLocale } from "@/i18n";

export const metadata: Metadata = { title: "Termos · Reels Autopilot" };

const copy = {
  pt: {
    title: "Termos de uso",
    updated: "Atualizados em 25 de outubro de 2026",
    sections: [
      ["O serviço", "O Reels Autopilot edita vídeos em várias versões, publica como Trial Reels no Instagram e mostra o que funcionou. Ele está em acesso antecipado: entrar com o Google guarda teu lugar na lista de espera."],
      ["Tua conta", "Tu és responsável pela conta Google usada no login e pelo conteúdo que pedir para publicar. Não use o serviço para conteúdo ilegal, enganoso ou que viole direitos de terceiros."],
      ["Instagram", "As publicações seguem as regras da Meta e do Instagram. Trial Reels aparecem só para quem não te segue; levar para os seguidores é decisão tua no app do Instagram."],
      ["Disponibilidade", "O serviço é oferecido como está, durante o acesso antecipado, sem garantia de funcionamento contínuo. Podemos mudar ou encerrar recursos com aviso por e-mail."],
      ["Encerramento", "Tu podes sair e excluir teus dados quando quiser pela tela de lista de espera. Dúvidas: veja a política de privacidade."],
    ] as [string, string][],
  },
  en: {
    title: "Terms of service",
    updated: "Updated October 25, 2026",
    sections: [
      ["The service", "Reels Autopilot edits videos into several versions, publishes them as Instagram Trial Reels and shows what worked. It is in early access: signing in with Google saves your waitlist spot."],
      ["Your account", "You are responsible for the Google account you sign in with and for the content you ask us to publish. Don't use the service for illegal, misleading or infringing content."],
      ["Instagram", "Posts follow Meta's and Instagram's rules. Trial Reels are shown to non-followers only; sharing them with followers is your call in the Instagram app."],
      ["Availability", "During early access the service is provided as is, without a guarantee of uninterrupted operation. We may change or retire features with notice by email."],
      ["Ending", "You can sign out and delete your data at any time from the waitlist screen. Questions: see the privacy policy."],
    ] as [string, string][],
  },
  es: {
    title: "Términos de uso",
    updated: "Actualizados el 25 de octubre de 2026",
    sections: [
      ["El servicio", "Reels Autopilot edita videos en varias versiones, los publica como Trial Reels en Instagram y muestra qué funcionó. Está en acceso anticipado: entrar con Google guarda tu lugar en la lista de espera."],
      ["Tu cuenta", "Eres responsable de la cuenta de Google con la que entras y del contenido que pidas publicar. No uses el servicio para contenido ilegal, engañoso o que infrinja derechos de terceros."],
      ["Instagram", "Las publicaciones siguen las reglas de Meta e Instagram. Los Trial Reels se muestran solo a quien no te sigue; llevarlos a tus seguidores lo decides tú en la app de Instagram."],
      ["Disponibilidad", "Durante el acceso anticipado el servicio se ofrece tal cual, sin garantía de funcionamiento continuo. Podemos cambiar o retirar funciones avisando por correo."],
      ["Cierre", "Puedes salir y eliminar tus datos cuando quieras desde la pantalla de lista de espera. Dudas: mira la política de privacidad."],
    ] as [string, string][],
  },
};

export default async function TermsPage() {
  return <LegalPage {...copy[await getLocale()]} />;
}
