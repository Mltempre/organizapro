import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  getArticleBySlug,
  getRelatedArticles,
  ARTICLES,
  CATEGORY_COLORS,
  WPP_NUMBER,
  WPP_MESSAGE_BLOG,
  BASE_URL,
  type ContentBlock,
  type Article,
} from "../data/articles";

interface Props {
  params: { slug: string };
}

export async function generateStaticParams() {
  return ARTICLES.map((a) => ({ slug: a.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const article = getArticleBySlug(params.slug);
  if (!article) return {};

  const url = `${BASE_URL}/blog/${article.slug}`;
  const ogImage = `${BASE_URL}/og-blog.png`;

  return {
    title: article.title,
    description: article.description,
    keywords: article.keywords,
    authors: [{ name: article.author, url: BASE_URL }],
    creator: "OrganizaPro",
    publisher: "OrganizaPro",
    metadataBase: new URL(BASE_URL),
    alternates: {
      canonical: url,
      languages: { "pt-BR": url },
    },
    openGraph: {
      type: "article",
      siteName: "OrganizaPro",
      locale: "pt_BR",
      url,
      title: article.title,
      description: article.description,
      publishedTime: article.publishedAt,
      modifiedTime: article.publishedAt,
      authors: [article.author],
      section: article.category,
      tags: article.keywords,
      images: [
        {
          url: ogImage,
          width: 1200,
          height: 630,
          alt: article.title,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      site: "@organizapro",
      creator: "@organizapro",
      title: article.title,
      description: article.description,
      images: [ogImage],
    },
    robots: {
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
        "max-snippet": -1,
        "max-image-preview": "large",
        "max-video-preview": -1,
      },
    },
  };
}

function buildJsonLd(article: Article) {
  const url = `${BASE_URL}/blog/${article.slug}`;
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Article",
        "@id": `${url}#article`,
        headline: article.title,
        description: article.description,
        datePublished: article.publishedAt,
        dateModified: article.publishedAt,
        image: {
          "@type": "ImageObject",
          url: `${BASE_URL}/og-blog.png`,
          width: 1200,
          height: 630,
        },
        author: {
          "@type": "Organization",
          name: article.author,
          url: BASE_URL,
        },
        publisher: {
          "@type": "Organization",
          name: "OrganizaPro",
          url: BASE_URL,
          logo: {
            "@type": "ImageObject",
            url: `${BASE_URL}/logo.png`,
            width: 200,
            height: 60,
          },
        },
        mainEntityOfPage: {
          "@type": "WebPage",
          "@id": url,
        },
        keywords: article.keywords.join(", "),
        articleSection: article.category,
        inLanguage: "pt-BR",
        timeRequired: `PT${article.readingTime}M`,
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          {
            "@type": "ListItem",
            position: 1,
            name: "Home",
            item: BASE_URL,
          },
          {
            "@type": "ListItem",
            position: 2,
            name: "Blog",
            item: `${BASE_URL}/blog`,
          },
          {
            "@type": "ListItem",
            position: 3,
            name: article.title,
            item: url,
          },
        ],
      },
      {
        "@type": "Organization",
        "@id": `${BASE_URL}#organization`,
        name: "OrganizaPro",
        url: BASE_URL,
        description:
          "Sistema de automação de lembretes e avaliações para clínicas de saúde no Brasil.",
        contactPoint: {
          "@type": "ContactPoint",
          contactType: "customer support",
          availableLanguage: "Portuguese",
        },
      },
    ],
  };
}

const formatDate = (iso: string) => {
  const d = new Date(iso + "T12:00:00");
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });
};

function RenderBlock({ block }: { block: ContentBlock }) {
  const base: React.CSSProperties = { fontFamily: "DM Sans, sans-serif" };

  switch (block.type) {
    case "h2":
      return (
        <h2 style={{
          ...base, fontSize: "1.45rem", fontWeight: 800, color: "#e7ebff",
          margin: "48px 0 16px", lineHeight: 1.3,
          borderLeft: "3px solid #7c3aed", paddingLeft: 16,
        }}>
          {block.text}
        </h2>
      );

    case "h3":
      return (
        <h3 style={{
          ...base, fontSize: "1.1rem", fontWeight: 700, color: "#cbd5e1",
          margin: "32px 0 12px", lineHeight: 1.4,
        }}>
          {block.text}
        </h3>
      );

    case "p":
      return (
        <p style={{
          ...base, fontSize: "1.0rem", color: "#94a3b8", lineHeight: 1.85,
          margin: "0 0 20px",
        }}>
          {block.text}
        </p>
      );

    case "ul":
      return (
        <ul style={{ margin: "0 0 24px", paddingLeft: 0, listStyle: "none" }}>
          {block.items.map((item, i) => (
            <li key={i} style={{
              ...base, display: "flex", gap: 12, alignItems: "flex-start",
              padding: "8px 0", borderBottom: "1px solid rgba(255,255,255,0.04)",
              fontSize: "0.95rem", color: "#94a3b8", lineHeight: 1.6,
            }}>
              <span style={{ color: "#7c3aed", fontWeight: 700, marginTop: 2, flexShrink: 0 }}>▸</span>
              {item}
            </li>
          ))}
        </ul>
      );

    case "ol":
      return (
        <ol style={{ margin: "0 0 24px", paddingLeft: 0, listStyle: "none", counterReset: "step" }}>
          {block.items.map((item, i) => (
            <li key={i} style={{
              ...base, display: "flex", gap: 16, alignItems: "flex-start",
              padding: "10px 0", borderBottom: "1px solid rgba(255,255,255,0.04)",
              fontSize: "0.95rem", color: "#94a3b8", lineHeight: 1.6,
            }}>
              <span style={{
                background: "rgba(124,58,237,0.2)", border: "1px solid rgba(124,58,237,0.3)",
                color: "#a78bfa", fontWeight: 800, fontSize: 12,
                width: 28, height: 28, borderRadius: "50%",
                display: "flex", alignItems: "center", justifyContent: "center",
                flexShrink: 0,
              }}>
                {i + 1}
              </span>
              {item}
            </li>
          ))}
        </ol>
      );

    case "highlight":
      return (
        <blockquote style={{
          background: "linear-gradient(135deg, rgba(124,58,237,0.08), rgba(109,40,217,0.05))",
          border: "1px solid rgba(124,58,237,0.2)",
          borderLeft: "4px solid #7c3aed",
          borderRadius: 16, padding: "24px 28px",
          margin: "32px 0",
        }}>
          <p style={{
            ...base, fontSize: "1.05rem", color: "#c4b5fd", lineHeight: 1.75,
            fontStyle: "italic", margin: "0 0 12px",
          }}>
            {block.text}
          </p>
          {block.author && (
            <p style={{ ...base, margin: 0, fontSize: 13, color: "#6d28d9", fontWeight: 600 }}>
              — {block.author}{block.role ? `, ${block.role}` : ""}
            </p>
          )}
        </blockquote>
      );

    case "tip":
      return (
        <div style={{
          background: "rgba(34,211,238,0.05)", border: "1px solid rgba(34,211,238,0.15)",
          borderRadius: 14, padding: "20px 24px", margin: "28px 0",
        }}>
          <p style={{
            ...base, fontSize: 11, fontWeight: 700, color: "#22d3ee",
            textTransform: "uppercase", letterSpacing: "0.08em", margin: "0 0 8px",
          }}>
            💡 {block.label}
          </p>
          <p style={{ ...base, fontSize: "0.9rem", color: "#7dd3fc", lineHeight: 1.7, margin: 0 }}>
            {block.text}
          </p>
        </div>
      );

    case "stat":
      return (
        <div style={{
          background: "rgba(124,58,237,0.08)", border: "1px solid rgba(124,58,237,0.2)",
          borderRadius: 16, padding: "28px 24px", margin: "32px 0",
          textAlign: "center",
        }}>
          <p style={{
            ...base, fontSize: "3rem", fontWeight: 900, color: "#a78bfa",
            margin: "0 0 8px", lineHeight: 1,
          }}>
            {block.value}
          </p>
          <p style={{ ...base, fontSize: "0.9rem", color: "#6d28d9", margin: 0, fontWeight: 600 }}>
            {block.label}
          </p>
        </div>
      );

    case "cta":
      return (
        <div style={{
          background: "linear-gradient(135deg, rgba(124,58,237,0.15), rgba(109,40,217,0.1))",
          border: "1px solid rgba(124,58,237,0.3)",
          borderRadius: 20, padding: "40px 36px",
          margin: "48px 0 24px", textAlign: "center",
        }}>
          <p style={{ ...base, fontSize: 28, margin: "0 0 12px" }}>🚀</p>
          <h3 style={{
            ...base, fontSize: "1.4rem", fontWeight: 800, color: "#e7ebff",
            margin: "0 0 12px",
          }}>
            Quer ver isso funcionando no seu negócio?
          </h3>
          <p style={{
            ...base, fontSize: "0.95rem", color: "#94a3b8", lineHeight: 1.7,
            margin: "0 0 28px",
          }}>
            O OrganizaPro automatiza lembretes, confirmações e avaliações pelo WhatsApp. Agende uma demonstração personalizada e veja o sistema funcionando com os dados do seu negócio.
          </p>
          <a
            href={`https://wa.me/${WPP_NUMBER}?text=${WPP_MESSAGE_BLOG}`}
            target="_blank" rel="noopener noreferrer"
            style={{
              display: "inline-block",
              background: "linear-gradient(135deg, #7c3aed, #6d28d9)",
              color: "#fff", padding: "14px 32px", borderRadius: 14,
              fontSize: 15, fontWeight: 700, textDecoration: "none",
              boxShadow: "0 4px 24px rgba(124,58,237,0.4)",
              fontFamily: "DM Sans, sans-serif",
            }}
          >
            📲 Agendar Demonstração Gratuita
          </a>
          <p style={{
            ...base, fontSize: 12, color: "#475569", margin: "16px 0 0",
          }}>
            Implantação assistida • Configuração rápida • Suporte especializado
          </p>
        </div>
      );

    default:
      return null;
  }
}

export default function ArticlePage({ params }: Props) {
  const article = getArticleBySlug(params.slug);
  if (!article) notFound();

  const jsonLd = buildJsonLd(article);

  const related = getRelatedArticles(params.slug);
  const catColors = CATEGORY_COLORS[article.category];

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <style>{`
        .article-body h2:first-of-type { margin-top: 0; }
        @media (max-width: 720px) {
          .article-layout { flex-direction: column !important; }
          .article-sidebar { display: none !important; }
          .article-title { font-size: 1.75rem !important; }
        }
      `}</style>

      <nav style={{
        position: "sticky", top: 0, zIndex: 100,
        background: "rgba(4,7,20,0.92)", backdropFilter: "blur(12px)",
        borderBottom: "1px solid rgba(255,255,255,0.07)",
        padding: "0 24px", display: "flex", alignItems: "center",
        justifyContent: "space-between", height: 64,
      }}>
        <Link href="/" style={{ textDecoration: "none", display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 20, fontWeight: 800, color: "#e7ebff", fontFamily: "DM Sans, sans-serif" }}>
            Organiza<span style={{ color: "#7c3aed" }}>Pro</span>
          </span>
        </Link>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <Link href="/blog" style={{
            color: "#94a3b8", fontSize: 14, fontFamily: "DM Sans, sans-serif",
            textDecoration: "none", fontWeight: 500,
          }}>
            ← Voltar ao Blog
          </Link>
          <a
            href={`https://wa.me/${WPP_NUMBER}?text=${WPP_MESSAGE_BLOG}`}
            target="_blank" rel="noopener noreferrer"
            style={{
              background: "linear-gradient(135deg, #7c3aed, #6d28d9)",
              color: "#fff", padding: "8px 18px", borderRadius: 10,
              fontSize: 13, fontWeight: 700, textDecoration: "none",
              fontFamily: "DM Sans, sans-serif",
            }}
          >
            Agendar Demo
          </a>
        </div>
      </nav>

      {/* Article header */}
      <header style={{
        background: "linear-gradient(160deg, #07091c 0%, #0d0b1e 60%, #040714 100%)",
        padding: "60px 24px 48px",
        borderBottom: "1px solid rgba(255,255,255,0.06)",
      }}>
        <div style={{ maxWidth: 760, margin: "0 auto" }}>
          {/* Breadcrumb */}
          <div style={{
            display: "flex", alignItems: "center", gap: 8, marginBottom: 24,
            fontSize: 13, fontFamily: "DM Sans, sans-serif",
          }}>
            <Link href="/blog" style={{ color: "#475569", textDecoration: "none" }}>Blog</Link>
            <span style={{ color: "#334155" }}>›</span>
            <span style={{
              background: catColors.bg, color: catColors.text,
              padding: "3px 10px", borderRadius: 20, fontSize: 11, fontWeight: 700,
              textTransform: "uppercase", letterSpacing: "0.04em",
            }}>
              {article.category}
            </span>
          </div>

          <h1 className="article-title" style={{
            fontSize: "2.2rem", fontWeight: 900, color: "#e7ebff",
            lineHeight: 1.2, margin: "0 0 20px",
            fontFamily: "DM Sans, sans-serif",
          }}>
            {article.title}
          </h1>

          <p style={{
            fontSize: "1.05rem", color: "#64748b", lineHeight: 1.7,
            margin: "0 0 32px", fontFamily: "DM Sans, sans-serif",
          }}>
            {article.description}
          </p>

          {/* Meta */}
          <div style={{
            display: "flex", alignItems: "center", gap: 20, flexWrap: "wrap",
            paddingTop: 24, borderTop: "1px solid rgba(255,255,255,0.07)",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{
                width: 36, height: 36, borderRadius: "50%",
                background: "rgba(124,58,237,0.2)", border: "1px solid rgba(124,58,237,0.3)",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 16,
              }}>
                ✍️
              </div>
              <div>
                <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: "#94a3b8", fontFamily: "DM Sans, sans-serif" }}>
                  {article.author}
                </p>
                <p style={{ margin: 0, fontSize: 11, color: "#475569", fontFamily: "DM Sans, sans-serif" }}>
                  {article.authorRole}
                </p>
              </div>
            </div>
            <div style={{ display: "flex", gap: 16 }}>
              <span style={{ fontSize: 13, color: "#475569", fontFamily: "DM Sans, sans-serif" }}>
                📅 {formatDate(article.publishedAt)}
              </span>
              <span style={{ fontSize: 13, color: "#475569", fontFamily: "DM Sans, sans-serif" }}>
                ⏱ {article.readingTime} min de leitura
              </span>
            </div>
          </div>
        </div>
      </header>

      {/* Body */}
      <main style={{ maxWidth: 760, margin: "0 auto", padding: "48px 24px 80px" }}>
        <div className="article-body">
          {article.content.map((block, i) => (
            <RenderBlock key={i} block={block} />
          ))}
        </div>

        {/* Tags */}
        <div style={{
          marginTop: 48, paddingTop: 32,
          borderTop: "1px solid rgba(255,255,255,0.07)",
        }}>
          <p style={{
            fontSize: 12, color: "#334155", fontFamily: "DM Sans, sans-serif",
            margin: "0 0 12px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em",
          }}>
            Palavras-chave
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {article.keywords.map((kw) => (
              <span key={kw} style={{
                background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)",
                color: "#475569", fontSize: 12, padding: "4px 12px", borderRadius: 20,
                fontFamily: "DM Sans, sans-serif",
              }}>
                {kw}
              </span>
            ))}
          </div>
        </div>

        {/* Related articles */}
        {related.length > 0 && (
          <div style={{ marginTop: 64 }}>
            <h2 style={{
              fontSize: "1.25rem", fontWeight: 800, color: "#e7ebff",
              fontFamily: "DM Sans, sans-serif", margin: "0 0 24px",
            }}>
              Artigos Relacionados
            </h2>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
              {related.map((rel) => {
                const relColors = CATEGORY_COLORS[rel.category];
                return (
                  <Link key={rel.slug} href={`/blog/${rel.slug}`} style={{ textDecoration: "none" }}>
                    <div style={{
                      background: "#08101d", border: "1px solid rgba(255,255,255,0.07)",
                      borderRadius: 16, padding: "20px",
                      transition: "border-color 0.2s",
                    }}>
                      <span style={{
                        background: relColors.bg, color: relColors.text,
                        fontSize: 10, fontWeight: 700, padding: "3px 8px", borderRadius: 20,
                        fontFamily: "DM Sans, sans-serif", textTransform: "uppercase",
                        letterSpacing: "0.04em", display: "inline-block", marginBottom: 10,
                      }}>
                        {rel.category}
                      </span>
                      <h3 style={{
                        fontSize: "0.9rem", fontWeight: 700, color: "#cbd5e1",
                        fontFamily: "DM Sans, sans-serif", margin: "0 0 8px", lineHeight: 1.4,
                      }}>
                        {rel.title}
                      </h3>
                      <p style={{
                        fontSize: 12, color: "#475569", fontFamily: "DM Sans, sans-serif", margin: 0,
                      }}>
                        ⏱ {rel.readingTime} min
                      </p>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        )}

        {/* Final CTA */}
        <div style={{
          marginTop: 64,
          background: "linear-gradient(135deg, rgba(124,58,237,0.12), rgba(109,40,217,0.08))",
          border: "1px solid rgba(124,58,237,0.2)",
          borderRadius: 20, padding: "36px",
          display: "flex", alignItems: "center", justifyContent: "space-between",
          gap: 24, flexWrap: "wrap",
        }}>
          <div>
            <h3 style={{
              fontSize: "1.2rem", fontWeight: 800, color: "#e7ebff",
              fontFamily: "DM Sans, sans-serif", margin: "0 0 8px",
            }}>
              Automatize seu negócio com o OrganizaPro
            </h3>
            <p style={{
              fontSize: "0.9rem", color: "#94a3b8",
              fontFamily: "DM Sans, sans-serif", margin: 0,
            }}>
              Demonstração personalizada + implantação assistida inclusa.
            </p>
          </div>
          <a
            href={`https://wa.me/${WPP_NUMBER}?text=${WPP_MESSAGE_BLOG}`}
            target="_blank" rel="noopener noreferrer"
            style={{
              background: "linear-gradient(135deg, #7c3aed, #6d28d9)",
              color: "#fff", padding: "12px 24px", borderRadius: 12,
              fontSize: 14, fontWeight: 700, textDecoration: "none",
              fontFamily: "DM Sans, sans-serif", whiteSpace: "nowrap",
              boxShadow: "0 4px 20px rgba(124,58,237,0.35)",
            }}
          >
            📲 Agendar Demonstração
          </a>
        </div>
      </main>

      <footer style={{
        borderTop: "1px solid rgba(255,255,255,0.06)",
        padding: "32px 24px", textAlign: "center",
      }}>
        <Link href="/blog" style={{
          color: "#475569", fontSize: 13, fontFamily: "DM Sans, sans-serif",
          textDecoration: "none",
        }}>
          ← Voltar ao Blog OrganizaPro
        </Link>
      </footer>
    </>
  );
}
