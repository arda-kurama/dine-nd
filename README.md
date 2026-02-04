# DineND

[![React Native](https://img.shields.io/badge/React%20Native-20232A?style=flat-square&logo=react&logoColor=61DAFB)](https://reactnative.dev/)
[![Python](https://img.shields.io/badge/Python-3.12-3776AB?style=flat-square&logo=python&logoColor=FFD43B)](https://python.org/)
[![Flask](https://img.shields.io/badge/Flask-2.3.2-000000?style=flat-square&logo=flask&logoColor=white)](https://flask.palletsprojects.com/)
[![AWS Lambda](https://img.shields.io/badge/AWS%20Lambda-FF9900?style=flat-square&logo=amazon-aws&logoColor=white)](https://aws.amazon.com/lambda/)
[![Pinecone](https://img.shields.io/badge/Pinecone-017ACD?style=flat-square&logo=pinecone&logoColor=white)](https://www.pinecone.io/)
[![OpenAI](https://img.shields.io/badge/OpenAI-412991?style=flat-square&logo=openai&logoColor=white)](https://openai.com/)
[![Statsig](https://img.shields.io/badge/Statsig-analytics-blue?style=flat-square&logo=data:image/svg+xml;base64,...)](https://www.statsig.com/)
<br>
[![Daily Update](https://github.com/arda-kurama/dine-nd/actions/workflows/daily-update.yml/badge.svg)](https://github.com/arda-kurama/dine-nd/actions/workflows/daily-update.yml)
[![AWS Deploy](https://github.com/arda-kurama/dine-nd/actions/workflows/aws-deploy.yml/badge.svg)](https://github.com/arda-kurama/dine-nd/actions/workflows/aws-deploy.yml)
[![Auto Submit](https://github.com/arda-kurama/dine-nd/actions/workflows/auto-submit.yml/badge.svg)](https://github.com/arda-kurama/dine-nd/actions/workflows/auto-submit.yml)

DineND is a cross-platform mobile app that helps Notre Dame students browse dining hall menus, plan meals, and track nutrition using live data and AI-powered recommendations.

The system combines an automated daily data pipeline, a serverless backend, and an AI-driven meal planner used by hundreds of students daily.

## Key Features

- **Automated Menu Ingestion**  
  Daily scraping pipeline fetches, normalizes, and publishes dining hall menu and nutrition data.

- **Plan My Plate (Manual Macro Tracking)**  
  Manually build a plate and track calories and macros in real time.

- **Plate Planner (AI Meal Planner)**  
  Generates meals based on calorie and macro goals using OpenAI.  
  Uses vector-based semantic retrieval (Pinecone) over daily menu data to ground AI output in actual availability.

- **Analytics**  
  Statsig integration for feature usage tracking and iteration.

## Tech Stack

**Mobile**

- React Native (Expo)
- TypeScript

**Backend & Data Pipeline**

- Python 3.12
- Selenium + BeautifulSoup
- Flask API

**AI & Retrieval**

- OpenAI API
- Pinecone (semantic retrieval for Plate Planner)

**Infrastructure**

- AWS Lambda (Zappa)
- GitHub Actions for daily automation and deployment

## Repository Structure

- `.github/workflows/` # CI/CD and scheduled jobs
- `cbord_scraper/` # CBORD dining data ingestion
- `nutrislice_scraper/` # Nutrislice dining data ingestion
- `plate_planner/` # AI meal planner API (AWS Lambda via Zappa)
- `mobile-app/` # React Native client
- `merge_menus.py` # Menu normalization and consolidation
- `requirements.txt` # Python dependencies

## What This Demonstrates

- Designing and operating a **production data pipeline**
- Building **serverless APIs** on AWS Lambda
- Applying **semantic retrieval** to constrain LLM outputs
- Integrating **AI features** into a real product
- Shipping and iterating on a **live mobile app**

## About

Built by **Arda Kurama**  
Computer Science @ University of Notre Dame (Class of 2027)

- [LinkedIn](https://linkedin.com/in/ardakurama)
- [Portfolio](https://ardakurama.com)
