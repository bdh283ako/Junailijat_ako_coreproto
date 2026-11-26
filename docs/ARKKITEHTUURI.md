# Junailijat – Sovellus- ja moduuliarkkitehtuuri

Tämä dokumentti esittää GitHubissa suoraan renderöityvät Mermaid-näkymät projektin paikallisesta kehitysympäristöstä ja `shellproto`-moduulirakenteesta. Tarkemmat Architecture-as-Code-lähteet sijaitsevat tiedostoissa [`docs/arkkitehtuuri_localhost.puml`](./arkkitehtuuri_localhost.puml) ja [`docs/arkkitehtuuri_shellproto.puml`](./arkkitehtuuri_shellproto.puml).

---

## 1. Paikallinen kehitysympäristö (localhost)

```mermaid
flowchart TB
    Developer([Kehittäjä]) -->|käynnistää| DevCommand["VS Code -terminaali<br/>(pnpm dev)"]
    User([Käyttäjä]) --> Browser

    subgraph LocalMachine["Kehittäjän kone"]
        DevCommand -->|Next.js dev -palvelin| AppRuntime

        subgraph AppRuntime["Node.js / Next.js 16.4.6"]
            direction TB
            subgraph AppRouter["Next.js App Router"]
                UI["React-käyttöliittymä<br/>(React 19.3.1)"]
                Routes["Sovellus-API:t<br/>/api/events, /api/families,<br/>/api/family-profile, /api/chat,<br/>/api/participations, /api/community-state"]
                Auth["Auth.js / NextAuth<br/>Google Provider (JWT)"]
                Payload["Payload CMS 4.0.0-beta.8<br/>Admin + kokoelmat + Local API"]
            end
            DBAdapter["PostgreSQL-adapteri<br/>(@payloadcms/db-postgres)"]
        end

        subgraph Docker["Docker Compose"]
            Postgres[("PostgreSQL 17<br/>postgres:17-alpine<br/>127.0.0.1:5432")]
            PGVolume[("postgres_data<br/>Docker-pysyvyysvolume")]
        end

        LegacyJson["data/demo-store.json<br/>(vain vanhan datan tuontiin)"]
    end

    subgraph Browser["Käyttäjän selain"]
        BrowserStorage["localStorage<br/>(vain kokeilunäkymien paikallinen tila)"]
    end

    Google(("Google Identity<br/>OAuth 2.0 / OIDC"))
    EventPulse(("EventPulse<br/>JSON-LD-syöte"))
    LinkedEvents(("Linked Events API<br/>Helsinki, Espoo, Vantaa"))
    Kauniainen(("Kauniaisten tapahtumasivu<br/>HTML-haku"))

    Browser -->|localhost:3000| UI
    UI -->|HTTP-pyynnöt| Routes
    UI -->|kirjautuminen| Auth
    UI -->|akotestaa-prototyypit & lukukuittaukset| BrowserStorage

    Auth -->|Google-kirjautuminen| Google
    Auth -->|käyttäjän luonti/päivitys| Payload
    Routes -->|istuntoon sidotut toiminnot| Payload
    Payload --> DBAdapter
    DBAdapter -->|DATABASE_URL| Postgres
    Postgres -->|pysyvä paikallinen data| PGVolume

    Routes -->|tapahtumahaku| EventPulse
    Routes -->|tapahtumahaku| LinkedEvents
    Routes -->|tapahtumahaku| Kauniainen

    DevCommand -.->|pnpm data:import-legacy| LegacyJson
```

---

## 2. Shellproto-komponentti- ja moduuliarkkitehtuuri

Vihreät moduulit on jo eriytetty omiin tiedostoihinsa; siniset ovat refaktoroinnin vaiheittainen työlista (`vaihe 1` → `vaihe 4b`).

```mermaid
flowchart LR
    classDef coordinator fill:#fefce8,stroke:#ca8a04,stroke-width:2px,color:#1e293b
    classDef extracted fill:#ecfdf5,stroke:#059669,stroke-width:1.5px,color:#064e3b
    classDef target fill:#eff6ff,stroke:#2563eb,stroke-dasharray: 5 5,stroke-width:1.5px,color:#1e3a8a
    classDef api fill:#f8fafc,stroke:#64748b,stroke-width:1.5px,color:#0f172a

    Page["page.tsx<br/>(Pääkoordinaattori & välilehtiohjaus)"]:::coordinator

    subgraph ExtractedPanels["Jo erotetut UI-paneelit"]
        HubPanel["CommunityHubPanel.tsx"]:::extracted
        ProfilePanel["ProfileSettingsPanel.tsx"]:::extracted
        MapView["PksMapView.tsx"]:::extracted
    end

    subgraph TargetPanels["Refaktoroitavat UI-paneelit (tavoitetila)"]
        DebugPanels["DebugMonitorPanels.tsx<br/>(Demo-Log & DB-Feed)"]:::target
        DockWindow["FloatingDockWindow.tsx<br/>(Raahattava kehys)"]:::target
        InspectorPanel["StoreInspectorPanel.tsx<br/>(Backscroll & JSON)"]:::target
        EventsPanel["EventsTabPanel.tsx<br/>(Tapahtumalista & suodatus)"]:::target
        FamiliesPanel["FamiliesTabPanel.tsx<br/>(Perheiden selaus & osumat)"]:::target
        MembersPanel["FamilyMembersPanel.tsx<br/>(Vanhemmat, lapset & läheiset)"]:::target
    end

    subgraph TargetHooks["Sivuvaikutus- ja datahookit (tavoitetila)"]
        HookSession["useGoogleSession.ts"]:::target
        HookEvents["useEventsFeed.ts"]:::target
        HookProfileSync["useFamilyProfileSync.ts"]:::target
    end

    subgraph Helpers["Jaetut apumoduulit"]
        ProtoData["protoData.ts"]:::extracted
        FeedClient["eventFeedClient.ts"]:::extracted
        GeoResolver["mapGeoResolver.ts"]:::extracted
        GCalHelper["googleCalendar.ts"]:::extracted
    end

    subgraph ApiLayer["Next.js App Router API-rajapinnat"]
        ApiAuth["/api/auth/*"]:::api
        ApiEvents["/api/events"]:::api
        ApiProfile["/api/family-profile"]:::api
    end

    LocalStorage[("localStorage<br/>(transientti UI-tila)")]:::api

    Page --> HubPanel
    Page --> ProfilePanel
    Page --> MapView
    Page --> ProtoData

    Page -.->|vaihe 1| DebugPanels
    DebugPanels -.-> DockWindow
    Page -.->|vaihe 1| InspectorPanel
    Page -.->|vaihe 2a| EventsPanel
    Page -.->|vaihe 3a| FamiliesPanel
    Page -.->|vaihe 3b| MembersPanel

    Page -.->|vaihe 2b| HookEvents
    Page -.->|vaihe 4a| HookSession
    Page -.->|vaihe 4b| HookProfileSync

    EventsPanel -.-> GCalHelper
    MapView --> GeoResolver
    HookEvents -.-> FeedClient

    HookSession -.-> ApiAuth
    HookEvents -.-> ApiEvents
    HookProfileSync -.-> ApiProfile
    HookProfileSync -.-> LocalStorage
```