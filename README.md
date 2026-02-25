```markdown
# 🧩 Bitespeed Identity Reconciliation Service

A backend web service that reconciles customer identities across multiple purchases by linking contact records using shared email or phone numbers.

---

## 🚀 Live Deployment

👉 Hosted API:  


---

## 📌 Problem Statement

Customers may use different email addresses or phone numbers across purchases.

The goal is to:
- Identify whether a customer already exists
- Link related contacts together
- Maintain one **primary contact**
- Mark others as **secondary**
- Return a consolidated identity response

Contacts are linked if they share:
- The same email OR
- The same phone number

The **oldest contact always remains primary**.

---

## 🛠️ Tech Stack

- Node.js
- TypeScript
- Express
- PostgreSQL
- Prisma ORM

---

## 🏗️ Project Architecture

```

src/
├── controllers/
│   └── identifyController.ts
├── services/
│   └── identifyService.ts
├── prisma.ts
└── index.ts

prisma/
├── schema.prisma
└── migrations/

````

---

## 🗄️ Database Schema

### Contact Table

| Field | Type | Description |
|--------|------|------------|
| id | Int | Primary Key |
| phoneNumber | String? | Optional |
| email | String? | Optional |
| linkedId | Int? | Points to primary contact |
| linkPrecedence | Enum | "primary" or "secondary" |
| createdAt | DateTime | Auto timestamp |
| updatedAt | DateTime | Auto updated |
| deletedAt | DateTime? | Nullable |

---

## 📡 API Endpoint

### POST `/identify`

### Request Body

```json
{
  "email": "string (optional)",
  "phoneNumber": "string (optional)"
}
```

At least one field must be provided.

---

## 📤 Response Format

```json
{
  "contact": {
    "primaryContactId": 1,
    "emails": ["primary@email.com", "secondary@email.com"],
    "phoneNumbers": ["123456"],
    "secondaryContactIds": [23]
  }
}
```

---

## 🧠 Business Logic

### Case 1 — No Existing Contact

* Create new contact
* Mark as `primary`
* Return response

### Case 2 — Existing Match Found

* Expand full contact cluster
* Determine oldest primary
* Convert other primaries → secondary
* Relink all contacts
* Insert new secondary if new data provided
* Return consolidated response

---

## 🔄 Example

### Request

```json
{
  "email": "mcfly@hillvalley.edu",
  "phoneNumber": "123456"
}
```

### Response

```json
{
  "contact": {
    "primaryContactId": 1,
    "emails": [
      "lorraine@hillvalley.edu",
      "mcfly@hillvalley.edu"
    ],
    "phoneNumbers": ["123456"],
    "secondaryContactIds": [23]
  }
}
```

---

## 🏃‍♂️ Running Locally

### 1️⃣ Clone Repository

```bash
git clone https://github.com/YOUR_USERNAME/bitespeed-identity.git
cd bitespeed-identity
```

---

### 2️⃣ Install Dependencies

```bash
npm install
```

---

### 3️⃣ Setup Environment Variables

Create `.env` file:

```
DATABASE_URL="postgresql://postgres:YOUR_PASSWORD@localhost:5432/bitespeed"
```

---

### 4️⃣ Run Prisma Migration

```bash
npx prisma migrate dev
```

---

### 5️⃣ Start Development Server

```bash
npm run dev
```

Server runs on:

```
http://localhost:3000
```

---

## 🧪 Testing Endpoint

Using Postman or curl:

```bash
curl -X POST http://localhost:3000/identify \
-H "Content-Type: application/json" \
-d '{"email":"test@example.com","phoneNumber":"999999"}'
```

---

## 🔐 Transaction Safety

The entire merge logic runs inside a Prisma transaction to ensure:

* No partial updates
* Data consistency
* Atomic cluster merging

---





## 👨‍💻 Author

Siddharth 
B.Tech IT
National Institute of Technology Kurukshetra

---

## 📄 License

This project is created for evaluation purposes as part of the Bitespeed Backend Assignment.

```

---

