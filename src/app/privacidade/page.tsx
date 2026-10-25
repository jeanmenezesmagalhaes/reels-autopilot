import type { Metadata } from "next";
import { LegalPage } from "@/components/legal-page";
import { getLocale } from "@/i18n";

export const metadata: Metadata = { title: "Privacidade · Reels Autopilot" };

const CONTACT = "ojeanmenezes@gmail.com";

const copy = {
  pt: {
    title: "Política de privacidade",
    updated: "Atualizada em 25 de outubro de 2026",
    sections: [
      ["O que coletamos", "Quando tu entras com o Google, recebemos teu nome e teu e-mail verificado. Não recebemos tua senha nem acesso a outros dados da tua conta Google. Para a conta dona do painel, guardamos também os vídeos editados até serem publicados, as legendas, e as métricas públicas dos Trial Reels (visualizações, alcance, curtidas, comentários, compartilhamentos, salvamentos e tempo assistido)."],
      ["Para que usamos", "Para te identificar no login, mostrar teu lugar na lista de espera, publicar os vídeos no Instagram da conta dona e analisar o que funcionou. Não vendemos dados e não usamos para publicidade."],
      ["Onde fica", "Os dados ficam na Vercel (aplicação e armazenamento de vídeos) e na Neon (banco de dados), com conexão criptografada. Os vídeos são apagados do armazenamento assim que publicados."],
      ["Com quem compartilhamos", "Com o Google, só para o login. Com a Meta (Instagram), só os vídeos e legendas que a conta dona decidiu publicar."],
      ["Teus direitos e exclusão", "Na tela de lista de espera existe o botão \"Excluir meus dados\", que apaga teu nome e e-mail na hora. Para qualquer outro pedido sobre teus dados, escreve para " + CONTACT + "."],
    ] as [string, string][],
  },
  en: {
    title: "Privacy policy",
    updated: "Updated October 25, 2026",
    sections: [
      ["What we collect", "When you sign in with Google we receive your name and verified email. We never receive your password or any other data from your Google account. For the dashboard owner we also store edited videos until they are published, captions, and the public Trial Reel metrics (views, reach, likes, comments, shares, saves and watch time)."],
      ["How we use it", "To identify you at sign-in, keep your waitlist spot, publish the owner's videos to Instagram and analyse what worked. We don't sell data or use it for advertising."],
      ["Where it lives", "Data is stored on Vercel (app and video storage) and Neon (database) over encrypted connections. Videos are deleted from storage as soon as they are published."],
      ["Who we share it with", "Google, only for sign-in. Meta (Instagram), only the videos and captions the owner chose to publish."],
      ["Your rights and deletion", "The waitlist screen has a \"Delete my data\" button that erases your name and email immediately. For any other request about your data, write to " + CONTACT + "."],
    ] as [string, string][],
  },
  es: {
    title: "Política de privacidad",
    updated: "Actualizada el 25 de octubre de 2026",
    sections: [
      ["Qué recopilamos", "Cuando entras con Google recibimos tu nombre y tu correo verificado. Nunca recibimos tu contraseña ni otros datos de tu cuenta de Google. Para la cuenta dueña del panel guardamos además los videos editados hasta publicarlos, los textos y las métricas públicas de los Trial Reels (vistas, alcance, me gusta, comentarios, compartidos, guardados y tiempo visto)."],
      ["Para qué lo usamos", "Para identificarte al entrar, guardar tu lugar en la lista de espera, publicar los videos de la cuenta dueña en Instagram y analizar qué funcionó. No vendemos datos ni los usamos para publicidad."],
      ["Dónde se guarda", "En Vercel (aplicación y almacenamiento de videos) y Neon (base de datos), con conexión cifrada. Los videos se borran del almacenamiento apenas se publican."],
      ["Con quién compartimos", "Con Google, solo para entrar. Con Meta (Instagram), solo los videos y textos que la cuenta dueña decidió publicar."],
      ["Tus derechos y eliminación", "En la pantalla de lista de espera está el botón \"Eliminar mis datos\", que borra tu nombre y correo al instante. Para cualquier otra solicitud, escribe a " + CONTACT + "."],
    ] as [string, string][],
  },
};

export default async function PrivacyPage() {
  return <LegalPage {...copy[await getLocale()]} />;
}
