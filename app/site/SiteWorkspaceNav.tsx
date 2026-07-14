"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { ExternalLink, Eye, LayoutDashboard } from "lucide-react";
import { supabase } from "../../lib/supabase";

const sections = [
  { label: "Visão geral", href: "/site" },
  { label: "Serviços", href: "/site/servicos" },
  { label: "Equipe", href: "/site/equipe" },
  { label: "Galeria", href: "/site/galeria" },
  { label: "Depoimentos", href: "/site/depoimentos" },
  { label: "FAQ", href: "/site/faq" },
  { label: "Estrutura", href: "/site/estrutura" },
  { label: "Antes/Depois", href: "/site/antes-depois" },
];

type Props = {
  siteUrl?: string;
  onPreview?: () => void;
  onPublish?: () => void;
  publishing?: boolean;
};

export default function SiteWorkspaceNav({ siteUrl: suppliedUrl, onPreview, onPublish, publishing = false }: Props) {
  const pathname = usePathname();
  const [loadedUrl, setLoadedUrl] = useState("");
  const publicUrl = suppliedUrl || loadedUrl;

  useEffect(() => {
    if (suppliedUrl) return;

    let active = true;
    async function loadPublicUrl() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from("clinica_config")
        .select("slug")
        .eq("user_id", user.id)
        .maybeSingle();
      if (active && data?.slug) setLoadedUrl(`${window.location.origin}/empresa/${data.slug}`);
    }
    loadPublicUrl();
    return () => { active = false; };
  }, [suppliedUrl]);

  return (
    <section className="site-workspace" aria-label="Área de edição do site">
      <div className="site-workspace__top">
        <div className="site-workspace__identity">
          <span className="site-workspace__icon"><LayoutDashboard size={17} /></span>
          <div>
            <strong>Site Premium</strong>
            <span>Edite, confira o site publicado e publique alterações</span>
          </div>
        </div>
        <div className="site-workspace__flow" aria-label="Fluxo de publicação">
          <span className="is-active">1. Editar</span><i />
          <span>2. Conferir publicado</span><i />
          <span>3. Publicar</span>
        </div>
        <div className="site-workspace__actions">
          {onPreview ? (
            <button className="site-workspace__preview" type="button" onClick={onPreview} disabled={!publicUrl}>
              <Eye size={15} /> Ver site publicado
            </button>
          ) : publicUrl ? (
            <a className="site-workspace__preview" href={publicUrl} target="_blank" rel="noreferrer">
              <ExternalLink size={15} /> Ver site publicado
            </a>
          ) : (
            <Link className="site-workspace__preview" href="/site">
              Configurar publicação
            </Link>
          )}
          {onPublish && (
            <button className="site-workspace__publish" type="button" onClick={onPublish} disabled={publishing}>
              {publishing ? "Publicando..." : "Publicar alterações"}
            </button>
          )}
        </div>
      </div>

      <nav className="site-workspace__nav" aria-label="Seções do Site Premium">
        {sections.map(section => {
          const active = pathname === section.href;
          return <Link key={section.href} href={section.href} className={`site-workspace__tab${active ? " is-active" : ""}`} aria-current={active ? "page" : undefined}>{section.label}</Link>;
        })}
      </nav>

      <style jsx global>{`
        .site-workspace{margin:0 0 26px;border:1px solid #252a38;border-radius:14px;background:#0a0d14;overflow:hidden;box-shadow:0 12px 30px rgba(0,0,0,.16)}
        .site-workspace__top{min-height:72px;padding:14px 16px;display:flex;align-items:center;gap:18px}
        .site-workspace__identity{display:flex;align-items:center;gap:11px;min-width:190px}
        .site-workspace__icon{width:36px;height:36px;border-radius:10px;display:grid;place-items:center;color:#7fc4d3;background:rgba(31,78,95,.3);border:1px solid rgba(127,196,211,.18)}
        .site-workspace__identity strong,.site-workspace__identity span{display:block}.site-workspace__identity strong{font-size:13px;color:#f1f5f9}.site-workspace__identity span{margin-top:3px;font-size:10px;color:#64748b}
        .site-workspace__flow{display:flex;align-items:center;justify-content:center;gap:8px;flex:1;color:#64748b;font-size:11px;font-weight:600;white-space:nowrap}.site-workspace__flow span.is-active{color:#7fc4d3}.site-workspace__flow i{width:24px;height:1px;background:#252a38}
        .site-workspace__actions{display:flex;align-items:center;gap:8px}.site-workspace__preview,.site-workspace__publish{min-height:38px;padding:0 13px;border-radius:8px;display:inline-flex;align-items:center;justify-content:center;gap:7px;text-decoration:none;font-family:inherit;font-size:12px;font-weight:700;cursor:pointer;white-space:nowrap;transition:border-color .18s,background .18s,color .18s,transform .18s}.site-workspace__preview{border:1px solid rgba(127,196,211,.25);background:rgba(31,78,95,.18);color:#a8d8e2}.site-workspace__preview:hover{border-color:rgba(127,196,211,.5);background:rgba(31,78,95,.32);color:#d8f1f5}.site-workspace__publish{border:1px solid rgba(74,155,176,.5);background:linear-gradient(135deg,#1F4E5F,#0d3547);color:#fff;box-shadow:0 6px 18px rgba(13,53,71,.28)}.site-workspace__publish:hover{transform:translateY(-1px);filter:brightness(1.12)}.site-workspace__preview:focus-visible,.site-workspace__publish:focus-visible,.site-workspace__tab:focus-visible{outline:2px solid #7fc4d3;outline-offset:2px}.site-workspace__preview:disabled,.site-workspace__publish:disabled{opacity:.45;cursor:not-allowed;transform:none}
        .site-workspace__nav{display:flex;align-items:center;gap:7px;padding:9px 12px 10px;overflow-x:auto;border-top:1px solid #1e2130;scrollbar-width:thin;scrollbar-color:#365d6a #111620;scroll-snap-type:x proximity}.site-workspace__tab{flex:0 0 auto;min-height:34px;padding:0 12px;border:1px solid transparent;border-radius:999px;display:inline-flex;align-items:center;color:#718096!important;background:transparent;text-decoration:none!important;font-size:12px;font-weight:600;white-space:nowrap;scroll-snap-align:start;transition:color .18s,background .18s,border-color .18s}.site-workspace__tab:hover{color:#b9dce4!important;background:rgba(74,155,176,.1);border-color:rgba(74,155,176,.16)}.site-workspace__tab.is-active{border-color:rgba(74,155,176,.34);background:rgba(31,78,95,.32);color:#d8f1f5!important;font-weight:750}
        @media(max-width:900px){.site-workspace__flow{display:none}.site-workspace__top{justify-content:space-between}}
        @media(max-width:560px){.site-workspace{margin-bottom:18px;border-radius:12px}.site-workspace__top{min-height:64px;padding:12px;display:grid;grid-template-columns:1fr auto;gap:11px}.site-workspace__identity{min-width:0}.site-workspace__identity span{display:none}.site-workspace__actions{grid-column:1/-1;width:100%}.site-workspace__preview,.site-workspace__publish{flex:1;padding:0 10px}.site-workspace__nav{gap:8px;padding:10px 12px 12px}.site-workspace__tab{min-height:38px;padding:0 14px;font-size:12.5px}}
      `}</style>
    </section>
  );
}
