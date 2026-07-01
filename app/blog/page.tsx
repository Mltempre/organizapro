"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import {
  ARTICLES,
  ALL_CATEGORIES,
  CATEGORY_COLORS,
  WPP_NUMBER,
  WPP_MESSAGE_BLOG,
  type Category,
} from "./data/articles";

const formatDate = (iso: string) => {
  const d = new Date(iso + "T12:00:00");
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });
};

export default function BlogPage() {
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState<Category | "Todos">("Todos");

  const filtered = useMemo(() => {
    return ARTICLES.filter((a) => {
      const matchCat = activeCategory === "Todos" || a.category === activeCategory;
      const q = search.toLowerCase();
      const matchSearch =
        !q ||
        a.title.toLowerCase().includes(q) ||
        a.excerpt.toLowerCase().includes(q) ||
        a.category.toLowerCase().includes(q);
      return matchCat && matchSearch;
    });
  }, [search, activeCategory]);

  return (
    <>
      <style>{`
        .blog-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 24px; }
        .blog-card:hover { transform: translateY(-4px); border-color: rgba(124,58,237,0.5) !important; }
        .blog-card { transition: transform 0.2s, border-color 0.2s; }
        .cat-btn:hover { border-color: rgba(124,58,237,0.6) !important; color: #e7ebff !important; }
        .cat-btn { transition: background 0.15s, border-color 0.15s, color 0.15s; }
        .search-input:focus { outline: none; border-color: #7c3aed !important; box-shadow: 0 0 0 3px rgba(124,58,237,0.2); }
        @media (max-width: 900px) { .blog-grid { grid-template-columns: repeat(2, 1fr); } }
        @media (max-width: 600px) {
          .blog-grid { grid-template-columns: 1fr; }
          .hero-title { font-size: 2rem !important; }
          .cat-scroll { flex-wrap: nowrap !important; overflow-x: auto; padding-bottom: 8px; }
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
            Clínica<span style={{ color: "#7c3aed" }}>Flow</span>
          </span>
          <span style={{
            background: "rgba(124,58,237,0.15)", border: "1px solid rgba(124,58,237,0.3)",
            color: "#a78bfa", fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 20,
          }}>Blog</span>
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
          Agendar Demonstração
        </a>
      </nav>

      {/* Hero */}
      <section style={{
        background: "linear-gradient(160deg, #07091c 0%, #0d0b1e 50%, #040714 100%)",
        padding: "80px 24px 64px",
        borderBottom: "1px solid rgba(255,255,255,0.06)",
      }}>
        <div style={{ maxWidth: 760, margin: "0 auto", textAlign: "center" }}>
          <div style={{
            display: "inline-flex", alignItems: "center", gap: 8,
            background: "rgba(124,58,237,0.1)", border: "1px solid rgba(124,58,237,0.25)",
            color: "#a78bfa", fontSize: 13, fontWeight: 600,
            padding: "6px 16px", borderRadius: 20, marginBottom: 24,
            fontFamily: "DM Sans, sans-serif",
          }}>
            📚 Conteúdo especializado para clínicas de saúde
          </div>
          <h1 className="hero-title" style={{
            fontSize: "2.75rem", fontWeight: 800, color: "#e7ebff",
            lineHeight: 1.15, margin: "0 0 16px",
            fontFamily: "DM Sans, sans-serif",
          }}>
            Estratégias que fazem<br />
            <span style={{ color: "#7c3aed" }}>clínicas crescerem de verdade</span>
          </h1>
          <p style={{
            fontSize: "1.1rem", color: "#94a3b8", lineHeight: 1.7,
            margin: "0 0 40px", fontFamily: "DM Sans, sans-serif",
          }}>
            Guias práticos sobre WhatsApp, avaliações no Google, gestão e automação — tudo focado em dentistas, dermatologistas, estetas e fisioterapeutas.
          </p>

          {/* Search */}
          <div style={{ position: "relative", maxWidth: 520, margin: "0 auto" }}>
            <span style={{
              position: "absolute", left: 16, top: "50%", transform: "translateY(-50%)",
              fontSize: 18, color: "#475569",
            }}>🔍</span>
            <input
              className="search-input"
              type="text"
              placeholder="Buscar artigos..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{
                width: "100%", padding: "14px 16px 14px 48px",
                background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: 14, color: "#e7ebff", fontSize: 15,
                fontFamily: "DM Sans, sans-serif", boxSizing: "border-box",
                transition: "border-color 0.2s",
              }}
            />
          </div>
        </div>
      </section>

      <div style={{ maxWidth: 1160, margin: "0 auto", padding: "48px 24px 80px" }}>

        {/* Categories */}
        <div className="cat-scroll" style={{
          display: "flex", gap: 10, marginBottom: 40, flexWrap: "wrap",
        }}>
          {(["Todos", ...ALL_CATEGORIES] as (Category | "Todos")[]).map((cat) => {
            const isActive = activeCategory === cat;
            const colors = cat !== "Todos" ? CATEGORY_COLORS[cat as Category] : null;
            return (
              <button
                key={cat}
                className="cat-btn"
                onClick={() => setActiveCategory(cat)}
                style={{
                  padding: "8px 18px", borderRadius: 30, cursor: "pointer",
                  fontSize: 13, fontWeight: 600, fontFamily: "DM Sans, sans-serif",
                  border: isActive
                    ? "1px solid rgba(124,58,237,0.8)"
                    : "1px solid rgba(255,255,255,0.1)",
                  background: isActive
                    ? "rgba(124,58,237,0.2)"
                    : colors
                    ? colors.bg
                    : "rgba(255,255,255,0.04)",
                  color: isActive
                    ? "#c4b5fd"
                    : colors
                    ? colors.text
                    : "#94a3b8",
                  whiteSpace: "nowrap",
                }}
              >
                {cat}
              </button>
            );
          })}
        </div>

        {/* Results count */}
        <p style={{
          color: "#475569", fontSize: 13, fontFamily: "DM Sans, sans-serif",
          marginBottom: 28,
        }}>
          {filtered.length} {filtered.length === 1 ? "artigo encontrado" : "artigos encontrados"}
          {activeCategory !== "Todos" ? ` em "${activeCategory}"` : ""}
          {search ? ` para "${search}"` : ""}
        </p>

        {/* Articles grid */}
        {filtered.length > 0 ? (
          <div className="blog-grid">
            {filtered.map((article) => {
              const catColors = CATEGORY_COLORS[article.category];
              return (
                <Link
                  key={article.slug}
                  href={`/blog/${article.slug}`}
                  style={{ textDecoration: "none" }}
                >
                  <article
                    className="blog-card"
                    style={{
                      background: "#08101d",
                      border: "1px solid rgba(255,255,255,0.07)",
                      borderRadius: 20, overflow: "hidden",
                      cursor: "pointer",
                    }}
                  >
                    {/* Card cover */}
                    <div style={{
                      background: "linear-gradient(135deg, #0d1628, #0a0f20)",
                      height: 140, display: "flex", alignItems: "center",
                      justifyContent: "center", fontSize: 52,
                      borderBottom: "1px solid rgba(255,255,255,0.05)",
                    }}>
                      {article.coverEmoji}
                    </div>

                    <div style={{ padding: "24px 24px 28px" }}>
                      {/* Category badge */}
                      <span style={{
                        display: "inline-block",
                        background: catColors.bg,
                        color: catColors.text,
                        fontSize: 11, fontWeight: 700,
                        padding: "4px 10px", borderRadius: 20,
                        fontFamily: "DM Sans, sans-serif",
                        marginBottom: 14, letterSpacing: "0.04em", textTransform: "uppercase",
                      }}>
                        {article.category}
                      </span>

                      <h2 style={{
                        fontSize: "1.05rem", fontWeight: 700, color: "#e7ebff",
                        lineHeight: 1.4, margin: "0 0 12px",
                        fontFamily: "DM Sans, sans-serif",
                      }}>
                        {article.title}
                      </h2>

                      <p style={{
                        fontSize: "0.875rem", color: "#64748b", lineHeight: 1.6,
                        margin: "0 0 20px", fontFamily: "DM Sans, sans-serif",
                        display: "-webkit-box", WebkitLineClamp: 3,
                        WebkitBoxOrient: "vertical", overflow: "hidden",
                      }}>
                        {article.excerpt}
                      </p>

                      <div style={{
                        display: "flex", alignItems: "center", justifyContent: "space-between",
                        borderTop: "1px solid rgba(255,255,255,0.06)", paddingTop: 16,
                      }}>
                        <div>
                          <p style={{ margin: 0, fontSize: 12, fontWeight: 600, color: "#94a3b8", fontFamily: "DM Sans, sans-serif" }}>
                            {article.author}
                          </p>
                          <p style={{ margin: 0, fontSize: 11, color: "#475569", fontFamily: "DM Sans, sans-serif" }}>
                            {formatDate(article.publishedAt)}
                          </p>
                        </div>
                        <span style={{
                          fontSize: 12, color: "#475569", fontFamily: "DM Sans, sans-serif",
                        }}>
                          ⏱ {article.readingTime} min
                        </span>
                      </div>
                    </div>
                  </article>
                </Link>
              );
            })}
          </div>
        ) : (
          <div style={{
            textAlign: "center", padding: "60px 24px",
            background: "rgba(255,255,255,0.02)", borderRadius: 20,
            border: "1px dashed rgba(255,255,255,0.08)",
          }}>
            <p style={{ fontSize: 40, margin: "0 0 16px" }}>🔍</p>
            <p style={{ color: "#64748b", fontSize: 16, fontFamily: "DM Sans, sans-serif" }}>
              Nenhum artigo encontrado para sua busca.
            </p>
            <button
              onClick={() => { setSearch(""); setActiveCategory("Todos"); }}
              style={{
                marginTop: 16, background: "rgba(124,58,237,0.15)",
                border: "1px solid rgba(124,58,237,0.3)", color: "#a78bfa",
                padding: "10px 20px", borderRadius: 10, cursor: "pointer",
                fontSize: 14, fontFamily: "DM Sans, sans-serif",
              }}
            >
              Limpar filtros
            </button>
          </div>
        )}

        {/* CTA Banner */}
        <div style={{
          marginTop: 80,
          background: "linear-gradient(135deg, rgba(124,58,237,0.15), rgba(109,40,217,0.1))",
          border: "1px solid rgba(124,58,237,0.25)",
          borderRadius: 24, padding: "48px 40px",
          display: "flex", alignItems: "center", justifyContent: "space-between",
          gap: 32, flexWrap: "wrap",
        }}>
          <div>
            <h2 style={{
              fontSize: "1.5rem", fontWeight: 800, color: "#e7ebff",
              margin: "0 0 8px", fontFamily: "DM Sans, sans-serif",
            }}>
              Pronto para automatizar sua clínica?
            </h2>
            <p style={{
              color: "#94a3b8", fontSize: "1rem", margin: 0,
              fontFamily: "DM Sans, sans-serif",
            }}>
              Veja o ClínicaFlow funcionando com os dados da sua clínica em uma demonstração personalizada.
            </p>
          </div>
          <a
            href={`https://wa.me/${WPP_NUMBER}?text=${WPP_MESSAGE_BLOG}`}
            target="_blank" rel="noopener noreferrer"
            style={{
              background: "linear-gradient(135deg, #7c3aed, #6d28d9)",
              color: "#fff", padding: "14px 28px", borderRadius: 14,
              fontSize: 15, fontWeight: 700, textDecoration: "none",
              fontFamily: "DM Sans, sans-serif", whiteSpace: "nowrap",
              boxShadow: "0 4px 24px rgba(124,58,237,0.4)",
            }}
          >
            📲 Agendar Demonstração
          </a>
        </div>
      </div>

      {/* Footer */}
      <footer style={{
        borderTop: "1px solid rgba(255,255,255,0.06)",
        padding: "32px 24px", textAlign: "center",
      }}>
        <p style={{ color: "#334155", fontSize: 13, fontFamily: "DM Sans, sans-serif", margin: 0 }}>
          © {new Date().getFullYear()} ClínicaFlow · Conteúdo especializado para clínicas de saúde
        </p>
      </footer>
    </>
  );
}
