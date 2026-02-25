<p align="center">
  <img src="https://img.shields.io/badge/Projet_officiel-Ville_de_Saint--Quentin-0a0a2e?style=for-the-badge&labelColor=030014&color=ffd475" alt="Projet officiel" />
  <img src="https://img.shields.io/badge/Galerie_Saint--Jacques-Nuit_des_Musées-7b5ea7?style=for-the-badge&labelColor=030014" alt="Nuit des Musées" />
  <img src="https://img.shields.io/badge/Three.js-r128-049ef4?style=for-the-badge&logo=threedotjs&logoColor=white&labelColor=030014" alt="Three.js" />
</p>

<h1 align="center">
  🪐 L'Observatoire des Mondes
</h1>

<p align="center">
  <strong>Transforme ton dessin en une planète vivante qui flotte dans l'espace.</strong>
</p>

<p align="center">
  <em>Installation interactive conçue pour la <b>Nuit des Musées</b> à la <b>Galerie Saint-Jacques</b>, Saint-Quentin (Aisne).</em>
</p>

<br/>

<p align="center">
  <img src="https://img.shields.io/badge/HTML5-E34F26?style=flat-square&logo=html5&logoColor=white" />
  <img src="https://img.shields.io/badge/CSS3-1572B6?style=flat-square&logo=css3&logoColor=white" />
  <img src="https://img.shields.io/badge/JavaScript-F7DF1E?style=flat-square&logo=javascript&logoColor=black" />
  <img src="https://img.shields.io/badge/Three.js-000000?style=flat-square&logo=threedotjs&logoColor=white" />
</p>

---

## ✨ Présentation

**L'Observatoire des Mondes** est une expérience web interactive développée dans le cadre d'une **commande officielle de la Ville de Saint-Quentin** pour la **Galerie Saint-Jacques** à l'occasion de la **Nuit des Musées**.

Le concept est simple et magique : les visiteurs dessinent une planète sur papier, puis la scannent avec leur téléphone. Leur dessin prend alors vie sous la forme d'une **planète 3D** réaliste, avec atmosphère, éclairage cinématique et rotation — flottant dans un champ d'étoiles.

## 🚀 Fonctionnalités

- **Capture caméra** — Scanne ton dessin directement via la caméra du téléphone avec un guide visuel circulaire
- **Import d'image** — Alternative pour importer un dessin depuis la galerie photo
- **Génération de texture** — Le dessin est automatiquement transformé en texture sphérique par mirroring horizontal avec blend doux
- **Rendu 3D temps réel** — Planète avec éclairage multi-sources (soleil, fill, rim, ambient), atmosphère shader, et inclinaison axiale réaliste (23.4°)
- **Interaction tactile** — Rotation par glisser, zoom par pinch ou molette, inertie physique
- **Capture d'écran** — Sauvegarde ta planète en image PNG
- **100% client-side** — Aucun serveur requis, fonctionne hors-ligne

## 📁 Structure du projet

```
observatoire-des-mondes/
├── index.html      # Structure HTML et éléments de l'interface
├── style.css       # Styles, animations et responsive design
├── app.js          # Logique applicative, caméra, Three.js, interactions
└── README.md
```

## 🛠️ Installation

Aucune dépendance à installer. Le projet utilise Three.js via CDN.

```bash
# Cloner le dépôt
git clone https://github.com/votre-utilisateur/observatoire-des-mondes.git

# Ouvrir dans un navigateur (un serveur local est recommandé pour la caméra)
cd observatoire-des-mondes
npx serve .
# ou
python3 -m http.server 8000
```

> **Note :** L'accès à la caméra nécessite un contexte sécurisé (`https://` ou `localhost`).

## 🎮 Utilisation

1. **Écran d'accueil** — Appuyer sur *« Scanner ma Planète »*
2. **Caméra** — Aligner le dessin dans le cercle guide, puis appuyer sur le bouton de capture (ou importer une image)
3. **Chargement** — La texture est générée automatiquement
4. **Planète** — Interagir avec la planète 3D : rotation, zoom, capture d'écran

## 🔧 Stack technique

| Composant | Technologie |
|-----------|------------|
| Rendu 3D | Three.js r128 |
| Atmosphère | Custom GLSL Shader (Fresnel) |
| Fond étoilé | Canvas 2D animé |
| Texture mapping | Canvas mirroring + blend |
| Interface | HTML/CSS vanilla, glassmorphism |
| Typographies | Cormorant Garamond + DM Sans |

## 🏛️ Contexte institutionnel

Ce projet a été réalisé dans le cadre d'une **commande officielle de la Ville de Saint-Quentin** pour l'événement de la **Nuit des Musées** à la **Galerie Saint-Jacques**.

L'objectif : proposer une installation numérique interactive et accessible à tous les publics, permettant aux visiteurs — enfants comme adultes — de créer leur propre planète à partir d'un simple dessin.

## 👤 Auteur

**Clément Mascret**
Service Civique — [QuentinWeb](https://www.quentinweb.fr), Ville de Saint-Quentin

---

<p align="center">
  <sub>Projet réalisé avec 💛 pour la Ville de Saint-Quentin et ses visiteurs.</sub>
</p>
