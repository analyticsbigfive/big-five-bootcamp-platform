import { ImageResponse } from "next/og"

export const runtime = "edge"
export const alt = "Laveiye - Bibliotheque de campagnes marketing africaines"
export const size = {
  width: 1200,
  height: 630,
}
export const contentType = "image/png"

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          position: "relative",
          display: "flex",
          height: "100%",
          width: "100%",
          overflow: "hidden",
          background: "#FBF7EE",
          color: "#0F0F0F",
          fontFamily: "Arial, Helvetica, sans-serif",
          padding: 64,
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: 0,
            background:
              "linear-gradient(135deg, #FFFDF8 0%, #F8F1E4 46%, #F2B33D 100%)",
          }}
        />
        <div
          style={{
            position: "absolute",
            right: -120,
            top: -80,
            width: 520,
            height: 520,
            borderRadius: 520,
            background: "rgba(15, 15, 15, 0.08)",
          }}
        />
        <div
          style={{
            position: "absolute",
            right: 86,
            bottom: 72,
            display: "flex",
            gap: 18,
            transform: "rotate(-4deg)",
          }}
        >
          {[0, 1, 2].map((item) => (
            <div
              key={item}
              style={{
                width: 138,
                height: 178,
                borderRadius: 18,
                background: item === 1 ? "#0F0F0F" : "rgba(255,255,255,0.82)",
                border: "2px solid rgba(15,15,15,0.12)",
                boxShadow: "0 22px 50px rgba(15,15,15,0.18)",
                display: "flex",
                flexDirection: "column",
                justifyContent: "flex-end",
                padding: 18,
              }}
            >
              <div
                style={{
                  width: "100%",
                  height: 12,
                  borderRadius: 12,
                  background: item === 1 ? "#F2B33D" : "rgba(15,15,15,0.22)",
                  marginBottom: 10,
                }}
              />
              <div
                style={{
                  width: "72%",
                  height: 12,
                  borderRadius: 12,
                  background: item === 1 ? "rgba(255,255,255,0.78)" : "rgba(15,15,15,0.16)",
                }}
              />
            </div>
          ))}
        </div>

        <div
          style={{
            position: "relative",
            zIndex: 1,
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            width: "100%",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
              <div
                style={{
                  width: 68,
                  height: 68,
                  borderRadius: 18,
                  background: "#0F0F0F",
                  color: "#F2B33D",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 38,
                  fontWeight: 900,
                }}
              >
                L
              </div>
              <div style={{ fontSize: 44, fontWeight: 900 }}>LAVEIYE</div>
            </div>
            <div
              style={{
                borderRadius: 999,
                background: "rgba(255,255,255,0.72)",
                border: "2px solid rgba(15,15,15,0.08)",
                padding: "12px 22px",
                color: "#8A5F12",
                fontSize: 24,
                fontWeight: 800,
              }}
            >
              Afrique francophone
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", maxWidth: 760 }}>
            <div style={{ display: "flex", flexDirection: "row", marginBottom: 24 }}>
              <div
                style={{
                  display: "flex",
                  borderRadius: 999,
                  background: "rgba(242,179,61,0.22)",
                  color: "#704B08",
                  padding: "12px 20px",
                  fontSize: 24,
                  fontWeight: 800,
                }}
              >
                Bibliotheque creative africaine
              </div>
            </div>
            <div style={{ fontSize: 72, fontWeight: 900, lineHeight: 1.04 }}>
              Observez, analysez et creez des campagnes plus fortes.
            </div>
            <div
              style={{
                marginTop: 24,
                maxWidth: 690,
                color: "rgba(15,15,15,0.68)",
                fontSize: 30,
                fontWeight: 600,
                lineHeight: 1.32,
              }}
            >
              Benchmark, veille creative et inspirations marketing pour l'Afrique.
            </div>
          </div>

          <div style={{ display: "flex", gap: 14, color: "rgba(15,15,15,0.68)", fontSize: 24, fontWeight: 800 }}>
            <div>Campagnes reelles</div>
            <div style={{ color: "#F2B33D" }}>•</div>
            <div>Filtres par pays</div>
            <div style={{ color: "#F2B33D" }}>•</div>
            <div>Analyse strategique</div>
          </div>
        </div>
      </div>
    ),
    size,
  )
}
