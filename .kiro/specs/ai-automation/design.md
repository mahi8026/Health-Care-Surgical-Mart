# AI & Automation Feature - Design Document

## 1. System Architecture Overview

### 1.1 High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     Client Applications                          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐         │
│  │   POS Web    │  │  Mobile App  │  │   Chatbot    │         │
│  │   Interface  │  │              │  │    Widget    │         │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘         │
└─────────┼──────────────────┼──────────────────┼─────────────────┘
          │                  │                  │
          └──────────────────┼──────────────────┘
                             │
                    ┌────────▼────────┐
                    │   API Gateway   │
                    │   (Express.js)  │
                    └────────┬────────┘
                             │
          ┌──────────────────┼──────────────────┐
          │                  │                  │
┌─────────▼─────────┐ ┌─────▼──────┐ ┌────────▼────────┐
│  Recommendation   │ │  Forecast  │ │    Chatbot      │
│     Service       │ │  Service   │ │    Service      │
│  (Node.js/Python) │ │  (Python)  │ │  (Node.js/NLP)  │
└─────────┬─────────┘ └─────┬──────┘ └────────┬────────┘
          │                  │                  │
          └──────────────────┼──────────────────┘
                             │
                    ┌────────▼────────┐
                    │  Data Layer     │
                    │  - MongoDB      │
                    │  - Redis Cache  │
                    │  - ML Models    │
                    └─────────────────┘
```

### 1.2 Technology Stack

**Backend Services:**

- Node.js (existing) - API Gateway, Chatbot Service
- Python - ML Services (Recommendations, Forecasting)
- Redis - Caching layer
- MongoDB - Primary database
- RabbitMQ/Bull - Job queue for async tasks

**ML/AI Technologies:**

- scikit-learn - ML algorithms
- TensorFlow/PyTorch - Deep learning (optional)
- pandas/numpy - Data processing
- OpenAI API - NLP for chatbot
- FastAPI - Python microservices

**Frontend:**

- React (existing)
- Chart.js/Recharts - Visualization
- Socket.io - Real-time chatbot

## 2. Smart Recommendations System Design

### 2.1 Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                  Recommendation Engine                       │
│                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │ Collaborative│  │ Content-Based│  │  Association │     │
│  │  Filtering   │  │   Filtering  │  │    Rules     │     │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘     │
│         │                  │                  │             │
│         └──────────────────┼──────────────────┘             │
│                            │                                │
│                   ┌────────▼────────┐                       │
│                   │  Hybrid Ranker  │                       │
│                   │  (Weighted Avg) │                       │
│                   └────────┬────────┘                       │
│                            │                                │
│                   ┌────────▼────────┐                       │
│                   │  Post-Processor │                       │
│                   │  - Dedup        │                       │
│                   │  - Filter       │                       │
│                   │  - Diversify    │                       │
│                   └────────┬────────┘                       │
└────────────────────────────┼──────────────────────────────┘
                             │
                    ┌────────▼────────┐
                    │  Redis Cache    │
                    │  (5 min TTL)    │
                    └─────────────────┘
```

### 2.2 Recommendation Algorithms

#### 2.2.1 Collaborative Filtering (User-Based)

```python
# Pseudocode
def collaborative_filtering(user_id, n_recommendations=5):
    # Find similar users based on purchase history
    similar_users = find_similar_users(user_id, similarity_threshold=0.7)

    # Get products purchased by similar users
    candidate_products = get_products_from_users(similar_users)

    # Remove products already purchased by current user
    user_purchases = get_user_purchases(user_id)
    candidates = candidate_products - user_purchases

    # Score based on frequency and similarity
    scores = calculate_scores(candidates, similar_users)

    return top_n(scores, n_recommendations)
```

#### 2.2.2 Content-Based Filtering

```python
# Pseudocode
def content_based_filtering(product_id, n_recommendations=5):
    # Get product features (category, brand, tags)
    product_features = get_product_features(product_id)

    # Find similar products using cosine similarity
    all_products = get_all_products()
    similarities = calculate_cosine_similarity(
        product_features,
        all_products
    )

    # Filter by minimum similarity threshold
    candidates = filter_by_threshold(similarities, threshold=0.6)

    return top_n(candidates, n_recommendations)
```

#### 2.2.3 Association Rules (Market Basket Analysis)

```python
# Pseudocode
def association_rules(cart_items, min_confidence=0.5):
    # Load pre-computed association rules
    rules = load_association_rules()

    # Find rules matching cart items
    matching_rules = []
    for item in cart_items:
        matching_rules.extend(
            rules.filter(antecedent=item, confidence >= min_confidence)
        )

    # Get consequent products
    recommendations = [rule.consequent for rule in matching_rules]

    # Sort by confidence * support
    recommendations.sort(key=lambda x: x.confidence * x.support)

    return recommendations[:5]
```

### 2.3 Data Models

#### 2.3.1 User-Product Interaction Matrix

```javascript
// MongoDB Collection: user_interactions
{
  _id: ObjectId,
  userId: ObjectId,
  productId: ObjectId,
  interactionType: "purchase" | "view" | "cart_add",
  quantity: Number,
  timestamp: Date,
  shopId: String
}
```

#### 2.3.2 Product Similarity Matrix

```javascript
// MongoDB Collection: product_similarities
{
  _id: ObjectId,
  productId: ObjectId,
  similarProducts: [
    {
      productId: ObjectId,
      similarityScore: Number,
      similarityType: "content" | "collaborative"
    }
  ],
  lastUpdated: Date,
  shopId: String
}
```

#### 2.3.3 Association Rules

```javascript
// MongoDB Collection: association_rules
{
  _id: ObjectId,
  antecedent: [ObjectId], // Product IDs
  consequent: [ObjectId], // Product IDs
  support: Number,        // 0-1
  confidence: Number,     // 0-1
  lift: Number,
  shopId: String,
  lastUpdated: Date
}
```

### 2.4 API Endpoints

#### GET /api/recommendations/cart

```javascript
// Request
{
  cartItems: [
    { productId: "...", quantity: 2 }
  ],
  userId: "..." // optional
}

// Response
{
  success: true,
  recommendations: [
    {
      productId: "...",
      name: "Product Name",
      price: 99.99,
      score: 0.85,
      reason: "Frequently bought together",
      inStock: true
    }
  ]
}
```

#### GET /api/recommendations/personalized/:userId

```javascript
// Response
{
  success: true,
  recommendations: [
    {
      productId: "...",
      name: "Product Name",
      score: 0.92,
      reason: "Based on your purchase history"
    }
  ]
}
```

### 2.5 Caching Strategy

- Cache recommendations for 5 minutes
- Cache key: `rec:{type}:{userId}:{cartHash}`
- Invalidate on: new purchase, product update, inventory change

## 3. Demand Forecasting System Design

### 3.1 Architecture

```
┌─────────────────────────────────────────────────────────────┐
│              Forecasting Pipeline                            │
│                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │ Data         │  │ Feature      │  │ Model        │     │
│  │ Aggregation  │─▶│ Engineering  │─▶│ Training     │     │
│  └──────────────┘  └──────────────┘  └──────┬───────┘     │
│                                              │             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────▼───────┐     │
│  │ Forecast     │◀─│ Model        │◀─│ Model        │     │
│  │ Storage      │  │ Prediction   │  │ Evaluation   │     │
│  └──────────────┘  └──────────────┘  └──────────────┘     │
└─────────────────────────────────────────────────────────────┘
```

### 3.2 Forecasting Models

#### 3.2.1 Time Series Models

```python
# ARIMA Model
from statsmodels.tsa.arima.model import ARIMA

def train_arima_model(sales_data, product_id):
    # Prepare time series data
    ts_data = prepare_time_series(sales_data, product_id)

    # Auto-select best parameters
    best_params = auto_arima(ts_data)

    # Train model
    model = ARIMA(ts_data, order=best_params)
    fitted_model = model.fit()

    return fitted_model

def forecast_arima(model, periods=30):
    forecast = model.forecast(steps=periods)
    confidence_intervals = model.get_forecast(periods).conf_int()

    return {
        'forecast': forecast,
        'lower_bound': confidence_intervals[:, 0],
        'upper_bound': confidence_intervals[:, 1]
    }
```

#### 3.2.2 Machine Learning Models

```python
# Random Forest Regressor
from sklearn.ensemble import RandomForestRegressor

def train_ml_model(features, target):
    # Features: day_of_week, month, is_holiday, lag_features, etc.
    model = RandomForestRegressor(
        n_estimators=100,
        max_depth=10,
        random_state=42
    )

    model.fit(features, target)
    return model

def create_features(sales_data):
    features = pd.DataFrame()

    # Time-based features
    features['day_of_week'] = sales_data.index.dayofweek
    features['month'] = sales_data.index.month
    features['day_of_month'] = sales_data.index.day
    features['is_weekend'] = features['day_of_week'].isin([5, 6])

    # Lag features
    for lag in [1, 7, 14, 30]:
        features[f'lag_{lag}'] = sales_data['quantity'].shift(lag)

    # Rolling statistics
    features['rolling_mean_7'] = sales_data['quantity'].rolling(7).mean()
    features['rolling_std_7'] = sales_data['quantity'].rolling(7).std()

    return features
```

### 3.3 Data Models

#### 3.3.1 Sales Aggregation

```javascript
// MongoDB Collection: sales_daily_agg
{
  _id: ObjectId,
  productId: ObjectId,
  date: Date,
  quantitySold: Number,
  revenue: Number,
  transactionCount: Number,
  shopId: String
}
```

#### 3.3.2 Forecast Results

```javascript
// MongoDB Collection: demand_forecasts
{
  _id: ObjectId,
  productId: ObjectId,
  forecastDate: Date,
  forecastHorizon: Number, // days
  predictions: [
    {
      date: Date,
      predictedDemand: Number,
      lowerBound: Number,
      upperBound: Number,
      confidence: Number
    }
  ],
  modelType: "arima" | "ml" | "ensemble",
  accuracy: {
    mape: Number,
    rmse: Number
  },
  generatedAt: Date,
  shopId: String
}
```

### 3.4 API Endpoints

#### GET /api/forecasting/demand/:productId

```javascript
// Query params: horizon=30|60|90
// Response
{
  success: true,
  product: {
    id: "...",
    name: "Product Name"
  },
  forecast: [
    {
      date: "2026-03-11",
      predictedDemand: 45,
      lowerBound: 38,
      upperBound: 52,
      confidence: 0.85
    }
  ],
  summary: {
    totalPredictedDemand: 1350,
    averageDailyDemand: 45,
    peakDemandDate: "2026-03-25",
    recommendedReorderQuantity: 500
  },
  accuracy: {
    mape: 18.5,
    lastUpdated: "2026-03-10T00:00:00Z"
  }
}
```

#### GET /api/forecasting/alerts

```javascript
// Response
{
  success: true,
  alerts: [
    {
      type: "stockout_risk",
      productId: "...",
      productName: "...",
      currentStock: 50,
      predictedStockoutDate: "2026-03-20",
      recommendedAction: "Reorder 200 units",
      severity: "high"
    }
  ]
}
```

### 3.5 Model Training Pipeline

```python
# Scheduled job (runs nightly)
def train_forecasting_models():
    # Get all products with sufficient history
    products = get_products_with_history(min_days=90)

    for product in products:
        # Fetch sales data
        sales_data = fetch_sales_data(product.id, days=365)

        # Train multiple models
        arima_model = train_arima_model(sales_data, product.id)
        ml_model = train_ml_model(sales_data, product.id)

        # Evaluate models
        arima_score = evaluate_model(arima_model, test_data)
        ml_score = evaluate_model(ml_model, test_data)

        # Select best model
        best_model = arima_model if arima_score < ml_score else ml_model

        # Generate forecasts
        forecast = generate_forecast(best_model, horizon=90)

        # Save to database
        save_forecast(product.id, forecast)

        # Check for alerts
        check_stockout_alerts(product.id, forecast)
```

## 4. Chatbot System Design

### 4.1 Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Chatbot Service                           │
│                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │   NLP        │  │  Intent      │  │  Entity      │     │
│  │  Processor   │─▶│  Classifier  │─▶│  Extractor   │     │
│  └──────────────┘  └──────────────┘  └──────────────┘     │
│                                              │             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────▼───────┐     │
│  │  Response    │◀─│  Dialog      │◀─│  Context     │     │
│  │  Generator   │  │  Manager     │  │  Manager     │     │
│  └──────┬───────┘  └──────────────┘  └──────────────┘     │
│         │                                                   │
│  ┌──────▼───────┐  ┌──────────────┐                       │
│  │  Knowledge   │  │  Escalation  │                       │
│  │  Base        │  │  Handler     │                       │
│  └──────────────┘  └──────────────┘                       │
└─────────────────────────────────────────────────────────────┘
```

### 4.2 NLP Integration

#### 4.2.1 OpenAI Integration

```javascript
// Using OpenAI GPT for intent classification and response generation
const OpenAI = require("openai");

class ChatbotNLP {
  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }

  async processMessage(userMessage, context) {
    const systemPrompt = `You are a helpful pharmacy assistant. 
    You can help with:
    - Product availability and pricing
    - Store hours and location
    - Order status
    - General product information
    
    Do NOT provide medical advice. For medical questions, 
    suggest consulting a pharmacist or doctor.
    
    Context: ${JSON.stringify(context)}`;

    const response = await this.openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMessage },
      ],
      temperature: 0.7,
      max_tokens: 150,
    });

    return {
      intent: this.extractIntent(response),
      entities: this.extractEntities(response),
      response: response.choices[0].message.content,
    };
  }

  extractIntent(response) {
    // Parse response to determine intent
    const text = response.choices[0].message.content.toLowerCase();

    if (text.includes("available") || text.includes("stock")) {
      return "product_availability";
    } else if (text.includes("hours") || text.includes("open")) {
      return "store_hours";
    } else if (text.includes("order") || text.includes("track")) {
      return "order_status";
    } else if (text.includes("price") || text.includes("cost")) {
      return "product_price";
    }

    return "general_inquiry";
  }
}
```

#### 4.2.2 Intent Classification

```javascript
// Intents supported
const INTENTS = {
  PRODUCT_AVAILABILITY: "product_availability",
  PRODUCT_PRICE: "product_price",
  PRODUCT_INFO: "product_info",
  STORE_HOURS: "store_hours",
  STORE_LOCATION: "store_location",
  ORDER_STATUS: "order_status",
  RETURN_POLICY: "return_policy",
  GENERAL_INQUIRY: "general_inquiry",
  MEDICAL_ADVICE: "medical_advice", // Auto-escalate
};

// Intent handlers
const intentHandlers = {
  async product_availability(entities, context) {
    const productName = entities.product;
    const product = await searchProduct(productName);

    if (!product) {
      return {
        message: `I couldn't find "${productName}". Could you try a different name?`,
        suggestions: await getSimilarProducts(productName),
      };
    }

    const stock = await getStockLevel(product.id);

    return {
      message: `${product.name} is ${stock > 0 ? "in stock" : "out of stock"}. 
                ${
                  stock > 0
                    ? `We have ${stock} units available.`
                    : "Would you like me to suggest alternatives?"
                }`,
      product: product,
      inStock: stock > 0,
    };
  },

  async store_hours(entities, context) {
    const storeInfo = await getStoreInfo(context.shopId);

    return {
      message: `We're open ${storeInfo.hours}. 
                ${
                  isStoreOpen(storeInfo)
                    ? "We are currently open!"
                    : "We are currently closed."
                }`,
      storeInfo: storeInfo,
    };
  },

  async order_status(entities, context) {
    const orderId = entities.orderId;

    if (!orderId) {
      return {
        message: "Please provide your order number to check status.",
        requiresInput: "orderId",
      };
    }

    const order = await getOrder(orderId);

    if (!order) {
      return {
        message: `I couldn't find order ${orderId}. Please check the number.`,
      };
    }

    return {
      message: `Your order ${orderId} is ${order.status}. 
                ${
                  order.status === "ready"
                    ? "You can pick it up now!"
                    : `Expected ready time: ${order.estimatedReady}`
                }`,
      order: order,
    };
  },
};
```

### 4.3 Data Models

#### 4.3.1 Conversation History

```javascript
// MongoDB Collection: chatbot_conversations
{
  _id: ObjectId,
  sessionId: String,
  userId: ObjectId, // optional
  shopId: String,
  messages: [
    {
      role: "user" | "assistant",
      content: String,
      timestamp: Date,
      intent: String,
      entities: Object
    }
  ],
  status: "active" | "resolved" | "escalated",
  escalatedTo: ObjectId, // staff member
  startedAt: Date,
  endedAt: Date,
  satisfaction: Number // 1-5
}
```

#### 4.3.2 Knowledge Base

```javascript
// MongoDB Collection: chatbot_knowledge
{
  _id: ObjectId,
  category: String,
  question: String,
  answer: String,
  keywords: [String],
  shopId: String,
  lastUpdated: Date
}
```

### 4.4 API Endpoints

#### POST /api/chatbot/message

```javascript
// Request
{
  sessionId: "...",
  message: "Is Paracetamol available?",
  userId: "..." // optional
}

// Response
{
  success: true,
  response: {
    message: "Paracetamol 500mg is in stock. We have 150 units available.",
    intent: "product_availability",
    suggestions: [
      "Would you like to know the price?",
      "Do you need directions to our store?"
    ],
    quickActions: [
      { label: "Check price", action: "product_price" },
      { label: "Store location", action: "store_location" }
    ]
  },
  sessionId: "..."
}
```

#### POST /api/chatbot/escalate

```javascript
// Request
{
  sessionId: "...",
  reason: "complex_medical_query"
}

// Response
{
  success: true,
  message: "Connecting you to a pharmacist...",
  estimatedWaitTime: 120 // seconds
}
```

### 4.5 Conversation Flow

```javascript
class ConversationManager {
  async handleMessage(sessionId, userMessage) {
    // 1. Load conversation context
    const context = await this.loadContext(sessionId);

    // 2. Process message with NLP
    const nlpResult = await this.nlp.processMessage(userMessage, context);

    // 3. Check for escalation triggers
    if (this.shouldEscalate(nlpResult, context)) {
      return await this.escalateToHuman(sessionId);
    }

    // 4. Handle intent
    const handler = intentHandlers[nlpResult.intent];
    const response = await handler(nlpResult.entities, context);

    // 5. Update context
    await this.updateContext(sessionId, {
      userMessage,
      intent: nlpResult.intent,
      response,
    });

    // 6. Generate suggestions
    const suggestions = await this.generateSuggestions(nlpResult, context);

    return {
      ...response,
      suggestions,
    };
  }

  shouldEscalate(nlpResult, context) {
    // Escalate if:
    // - Medical advice requested
    // - User frustrated (negative sentiment)
    // - Complex query (low confidence)
    // - User explicitly requests human

    return (
      nlpResult.intent === "medical_advice" ||
      context.sentimentScore < -0.5 ||
      nlpResult.confidence < 0.6 ||
      context.escalationRequested
    );
  }
}
```
