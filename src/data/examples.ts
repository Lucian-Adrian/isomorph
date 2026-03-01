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
];
