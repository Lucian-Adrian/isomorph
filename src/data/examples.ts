// ============================================================
// Example Diagrams — Built-in .isx snippets for the IDE
// ============================================================
// Extracted from App.tsx for maintainability (OCP — easy to add
// new examples without modifying App component).
// ============================================================

export interface Example {
  label: string;
  kind: string;
  source: string;
}

export const EXAMPLES: Example[] = [
  {
    label: 'Library System',
    kind: 'class',
    source: `// Library System — class diagram
diagram LibrarySystem : class {

  package domain {

    abstract class Book <<Entity>> implements Borrowable {
      + title: string
      + isbn: string
      - stock: int = 0
      + checkOut(user: string): bool
      + getTitle(): string
    }

    class Library {
      + name: string
      + addBook(book: Book): void
      + search(query: string): List<Book>
    }

    interface Borrowable {
      + borrow(user: string): void
      + return(): void
    }

    enum BookStatus {
      AVAILABLE
      CHECKED_OUT
      RESERVED
    }

  }

  Library --* Book [label="contains", toMult="1..*"]
  Book ..|> Borrowable

  @Book at (100, 130)
  @Library at (400, 130)
  @Borrowable at (100, 360)
  @BookStatus at (400, 360)

}
`,
  },
  {
    label: 'E-Commerce',
    kind: 'class',
    source: `// E-Commerce platform — class diagram
diagram ECommerce : class {

  abstract class User {
    + id: string
    + email: string
    + createdAt: string
    + login(password: string): bool
  }

  class Customer extends User {
    + address: string
    + placeOrder(items: List<CartItem>): Order
  }

  class Admin extends User {
    + role: string
    + manageProduct(p: Product): void
  }

  class Product {
    + id: string
    + name: string
    + price: float
    + stock: int
  }

  class Order {
    + id: string
    + total: float
    + status: OrderStatus
    + confirm(): void
  }

  enum OrderStatus {
    PENDING
    CONFIRMED
    SHIPPED
    DELIVERED
  }

  Customer --> Order [label="places", toMult="0..*"]
  Order --* Product [label="contains", toMult="1..*"]
  Admin --> Product [label="manages", toMult="0..*"]

  @User at (300, 60)
  @Customer at (100, 220)
  @Admin at (500, 220)
  @Product at (500, 400)
  @Order at (100, 400)
  @OrderStatus at (300, 540)

}
`,
  },
  {
    label: 'Use-Case',
    kind: 'usecase',
    source: `// Library use-case diagram
diagram LibraryUseCase : usecase {

  actor Student
  actor Librarian
  actor System

  usecase SearchBooks
  usecase BorrowBook
  usecase ReturnBook
  usecase ManageCatalog
  usecase GenerateReport

  Student --> SearchBooks
  Student --> BorrowBook
  Student --> ReturnBook
  Librarian --> ManageCatalog
  Librarian --> GenerateReport
  System --> GenerateReport [label="schedules"]

  @Student at (80, 300)
  @Librarian at (80, 480)
  @SearchBooks at (350, 180)
  @BorrowBook at (350, 300)
  @ReturnBook at (350, 420)
  @ManageCatalog at (650, 360)
  @GenerateReport at (650, 480)

}
`,
  },
  {
    label: 'Component',
    kind: 'component',
    source: `// Microservice architecture — component diagram
diagram MicroserviceArch : component {

  component APIGateway
  component AuthService
  component UserService
  component OrderService
  component NotificationService
  component Database

  APIGateway --> AuthService [label="authenticates"]
  APIGateway --> UserService [label="routes"]
  APIGateway --> OrderService [label="routes"]
  OrderService --> NotificationService [label="triggers"]
  UserService --> Database [label="persists"]
  OrderService --> Database [label="persists"]

  @APIGateway at (300, 40)
  @AuthService at (80, 160)
  @UserService at (300, 160)
  @OrderService at (520, 160)
  @NotificationService at (520, 300)
  @Database at (300, 300)

}
`,
  },
  {
    label: 'Deployment',
    kind: 'deployment',
    source: `// Cloud deployment — deployment diagram
diagram CloudDeploy : deployment {

  node WebServer
  node AppServer
  node DatabaseServer
  component Nginx
  component SpringBoot
  component PostgreSQL

  Nginx --> SpringBoot [label="reverse proxy"]
  SpringBoot --> PostgreSQL [label="JDBC"]

  @WebServer at (60, 60)
  @AppServer at (300, 60)
  @DatabaseServer at (540, 60)
  @Nginx at (60, 180)
  @SpringBoot at (300, 180)
  @PostgreSQL at (540, 180)

}
`,
  },
  {
    label: 'Sequence',
    kind: 'sequence',
    source: `// Authentication flow — sequence diagram
diagram AuthFlow : sequence {

  actor User
  participant AuthService
  participant Database
  participant TokenService

  User --> AuthService [label="login(email, pass)"]
  AuthService --> Database [label="findUser(email)"]
  Database ..> AuthService [label="userRecord"]
  AuthService --> AuthService [label="verifyPassword()"]
  AuthService --> TokenService [label="generateJWT(userId)"]
  TokenService ..> AuthService [label="token"]
  AuthService ..> User [label="{ token, profile }"]

  @User at (80, 60)
  @AuthService at (260, 60)
  @Database at (440, 60)
  @TokenService at (620, 60)

}
`,
  },
  {
    label: 'State',
    kind: 'state',
    source: `// Authentication Session — state diagram
diagram AuthSession : state {

  start Initial
  state LoggedOut
  state Authenticating
  state LoggedIn
  stop Final

  Initial --> LoggedOut
  LoggedOut --> Authenticating [label="login()"]
  Authenticating --> LoggedIn [label="success"]
  Authenticating --> LoggedOut [label="failure"]
  LoggedIn --> LoggedOut [label="logout()"]
  LoggedOut --> Final [label="destroy()"]

  @Initial at (160, 40)
  @LoggedOut at (120, 140)
  @Authenticating at (280, 140)
  @LoggedIn at (280, 260)
  @Final at (160, 280)

}
`
  },
  {
    label: 'Activity',
    kind: 'activity',
    source: `// Checkout Process — activity diagram
diagram Checkout : activity {

  start Start
  action AddToCart
  action EnterShipping
  fork Fork1
  action CalculateTax
  action CheckStock
  join Join1
  action ConfirmOrder
  stop End

  Start --> AddToCart
  AddToCart --> EnterShipping
  EnterShipping --> Fork1
  Fork1 --> CalculateTax
  Fork1 --> CheckStock
  CalculateTax --> Join1
  CheckStock --> Join1
  Join1 --> ConfirmOrder
  ConfirmOrder --> End

  @Start at (200, 40)
  @AddToCart at (160, 120)
  @EnterShipping at (160, 220)
  @Fork1 at (130, 320)
  @CalculateTax at (40, 380)
  @CheckStock at (240, 380)
  @Join1 at (130, 480)
  @ConfirmOrder at (160, 540)
  @End at (200, 640)

}
`
  },
  {
    label: 'Collaboration',
    kind: 'collaboration',
    source: `// MVC Pattern Updates — collaboration diagram
diagram MVCUpdate : collaboration {

  actor User
  object Controller
  object Model
  object View

  User --> Controller [label="1: click()"]
  Controller --> Model [label="2: updateData()"]
  Model --> View [label="3: notifyChange()"]
  View --> User [label="4: render()"]

  @User at (40, 160)
  @Controller at (280, 60)
  @Model at (560, 160)
  @View at (280, 280)

}
`
  },
  {
    label: 'Flow',
    kind: 'flow',
    source: `// Order Fulfillment — flow diagram
diagram OrderFlow : flow {

  start ReceiveOrder
  action CheckInventory
  decision InStock
  action ProcessPayment
  action Backorder
  stop Complete
  stop Cancelled

  ReceiveOrder --> CheckInventory
  CheckInventory --> InStock
  InStock --> ProcessPayment [label="Yes"]
  InStock --> Backorder [label="No"]
  ProcessPayment --> Complete [label="Success"]
  ProcessPayment --> Cancelled [label="Failed"]

  @ReceiveOrder at (160, 40)
  @CheckInventory at (120, 140)
  @InStock at (160, 240)
  @ProcessPayment at (40, 360)
  @Backorder at (280, 260)
  @Complete at (80, 480)
  @Cancelled at (0, 480)

}
`
  }
];
