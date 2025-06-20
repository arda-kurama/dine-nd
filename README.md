# 🍽️ DineND – Intelligent Nutrition and Dining App

[![React Native](https://img.shields.io/badge/React%20Native-20232A?style=flat-square&logo=react&logoColor=61DAFB)](https://reactnative.dev/)
[![Python](https://img.shields.io/badge/Python-3.12-3776AB?style=flat-square&logo=python&logoColor=FFD43B)](https://python.org/)
[![Flask](https://img.shields.io/badge/Flask-2.3.2-000000?style=flat-square&logo=flask&logoColor=white)](https://flask.palletsprojects.com/)
[![AWS Lambda](https://img.shields.io/badge/AWS%20Lambda-FF9900?style=flat-square&logo=amazon-aws&logoColor=white)](https://aws.amazon.com/lambda/)
[![Pinecone](https://img.shields.io/badge/Pinecone-017ACD?style=flat-square&logo=pinecone&logoColor=white)](https://www.pinecone.io/)
[![OpenAI](https://img.shields.io/badge/OpenAI-412991?style=flat-square&logo=openai&logoColor=white)](https://openai.com/)

[![Deploy to AWS](https://github.com/arda-kurama/dine-nd/actions/workflows/aws-deploy.yml/badge.svg)](https://github.com/arda-kurama/dine-nd/actions/workflows/aws-deploy.yml)
[![Daily Embed](https://github.com/arda-kurama/dine-nd/actions/workflows/daily-embed.yml/badge.svg)](https://github.com/arda-kurama/dine-nd/actions/workflows/daily-embed.yml)
[![Update Menu](https://github.com/arda-kurama/dine-nd/actions/workflows/update-menu.yml/badge.svg)](https://github.com/arda-kurama/dine-nd/actions/workflows/update-menu.yml)

**DineND** is a full-stack mobile application designed to enhance the dining experience for students at the University of Notre Dame. Leveraging powerful AI-driven meal recommendations, intelligent data scraping, and optimized backend services, DineND streamlines meal planning and nutrition tracking.

## 🚀 Key Features

-   **AI-Powered Meal Planner:** Suggests personalized meal combinations based on user-defined nutritional goals using OpenAI’s GPT models.
-   **Semantic Search Integration:** Utilizes Pinecone’s vector database for semantic similarity searches, significantly improving query accuracy and reducing response times.
-   **Real-Time Dining Data:** Scrapes and consolidates up-to-date dining hall menu data through optimized, concurrent web scraping, caching, and structured JSON outputs.
-   **Responsive Mobile UI:** Built with React Native for cross-platform support, providing intuitive navigation, real-time filters, and interactive meal details.
-   **Serverless Backend:** Flask API deployed on AWS Lambda via automated GitHub Actions workflows, ensuring robust, scalable, and efficient backend performance without persistent infrastructure.

## 🛠️ Technology Stack

### Frontend

-   **React Native** – Cross-platform mobile UI framework
-   **TypeScript** – Strongly typed frontend logic

### Backend

-   **Python (3.12)** – Core backend logic
-   **Flask** – RESTful API framework
-   **AWS Lambda & Zappa** – Serverless backend deployment
-   **GitHub Actions** – Automated CI/CD pipelines

### Data Layer

-   **Selenium & BeautifulSoup** – Efficient web scraping of nutritional data
-   **OpenAI API & Pinecone** – Semantic search and AI-driven meal planning
-   **JSON & SQLite** – Lightweight data storage and fast local querying

## 📈 Performance & Optimization

-   **90% Reduction in Scraping Runtime:** Parallelized data scraping using Python’s concurrent execution libraries, caching strategies, and memory-optimized scraping functions.
-   **85% Decrease in Query Latency:** Integrated Pinecone vector database indexing to dramatically reduce OpenAI token usage and speed up meal recommendations.
-   **Robust Error Handling:** Global Flask error handling with meaningful user feedback, graceful fallbacks, and detailed logging.

## 📱 UI/UX Highlights

-   **Plate Planner:** Interactive component to set nutritional goals, dietary restrictions, and receive AI-generated meal suggestions.
-   **Detailed Nutrition Facts:** Structured presentation of nutritional data, allergen warnings, and ingredient lists for informed meal choices.
-   **Intuitive Navigation:** Seamless user experience with smooth animations, responsive layout adjustments, and persistent interactive components.

## ⚙️ Deployment & DevOps

-   **Automated Deployment:** GitHub Actions workflows for seamless deployment to AWS Lambda using Zappa.
-   **Static JSON Delivery:** Leveraged GitHub Pages for static data delivery, minimizing backend load.
-   **Environment Management:** Clear, secure handling of environment variables for API keys and sensitive credentials.

## 📂 Project Structure Overview

```
dine-nd/
├── .github/                  # GitHub Actions and CI workflows
│   └── workflows/
│       ├── aws-deploy.yml
│       ├── daily-embed.yml
│       └── update-menu.yml
├── backend/                  # Backend scraping + menu processing
│   ├── __init__.py
│   ├── constants.py
│   ├── consolidate.py
│   ├── main.py
│   ├── parsers.py
│   ├── scraper.py
│   └── tasks.py
├── mobile-app/               # React Native app
│   ├── assets/
│   ├── src/
│   │   ├── components/
│   │   │   ├── constants.ts
│   │   │   ├── section_defs.json
│   │   │   ├── themes.ts
│   │   │   └── types.ts
│   │   ├── navigation/
│   │   │   └── index.tsx
│   │   └── screens/
│   │       ├── DiningHallScreen.tsx
│   │       ├── HallList.tsx
│   │       ├── InfoScreen.tsx
│   │       ├── ItemDetail.tsx
│   │       └── PlatePlanner.tsx
│   └── App.tsx
├── plate_planner/            # Serverless API for meal planning
│   ├── __init__.py
│   ├── embed_menu.py
│   ├── endpoint.py
│   └── zappa_settings.json
├── LICENSE
├── README.md
└── requirements.txt
```

## 📖 Getting Started

**Prerequisites:**

-   Node.js & npm
-   Python 3.12+
-   AWS Account with Lambda access
-   Pinecone & OpenAI API keys

**Installation:**

Clone the repository:

```sh
git clone https://github.com/arda-kurama/dine-nd.git
```

Setup frontend:

```sh
cd mobile-app
npm install
npx expo start
```

Setup backend:

```sh
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
python3 -m backend.main
```

Setup PlatePlanner API:

```sh
cd plate_planner
zappa deploy dev # First-time deployment
zappa update dev # On updates
```

## 🎓 About Me

**Arda Kurama** | [GitHub](https://github.com/arda-kurama) | [LinkedIn](https://linkedin.com/in/ardakurama) | [Portfolio](https://ardakurama.com)

Computer Science student at the University of Notre Dame (Class of 2027). Passionate about software engineering, system optimization, and AI-driven solutions. Pursuing software engineering internship opportunities for Summer 2026.

---
