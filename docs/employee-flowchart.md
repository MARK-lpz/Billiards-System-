# Employee Side Flowchart

How an employee moves through the staff app, from login to each module in the
Employee Panel. Diagrams are Mermaid, so they render on GitHub.

## 1. Overview: login and navigation

```mermaid
flowchart TD
    Start([Open staff app]) --> Login[Login page]
    Login -->|Forgot Password?| Forgot[Forgot Password modal<br/>request reset from admin] --> Login
    Login --> Submit{Credentials valid?}
    Submit -->|No| LoginErr[Show error] --> Login
    Submit -->|Yes| Role{User role}
    Role -->|admin| Admin[[Admin Dashboard]]
    Role -->|employee| Emp[Employee Panel<br/>default page: Pool Tables]

    Emp --> Nav{Sidebar}
    Nav --> PT[Pool Tables]
    Nav --> POS[Sales POS]
    Nav --> RD[Reservations Desk]
    Nav --> QA[Actions]
    Nav --> TS[Tournament Schedule]

    Emp --> Bell{Notification bell}
    Bell -->|New online booking| RD
    Bell -->|New player registration| TS

    Emp --> Menu{Profile menu}
    Menu --> Settings[Settings<br/>light / dark theme]
    Menu --> Logout([Logout]) --> Login

    Emp -.->|Any page, when a session runs out| TimeUp[Time's Up alert]
    TimeUp -->|+30 / +60 min| AddTime[Extend session<br/>if no next booking conflicts]
    TimeUp -->|End Session| Charge[Table charge sent to Sales POS]
    TimeUp -->|Later| Snooze[Remind later]
```

## 2. Pool Tables

```mermaid
flowchart TD
    PT[Pool Tables dashboard] --> Filter[Filter by status:<br/>All / Available / Occupied / Reserved]
    Filter --> Card{Table card status}

    Card -->|Available| WalkIn[Walk-in] --> WIModal[Enter customer name<br/>and hours staying]
    WIModal --> Occ[Table: Occupied<br/>timer starts]

    Card -->|Reserved| ResChoice{Action}
    ResChoice -->|Check In| CanCheck{Within check-in window?}
    CanCheck -->|No| CheckErr[Error toast:<br/>can't check in] --> Card
    CanCheck -->|Yes| Seated[Booking: Seated<br/>table: Occupied for booked hours] --> Occ
    ResChoice -->|Cancel| CancelModal[Confirm cancel] --> Cancelled[Booking: Cancelled<br/>table: Available<br/>admin notified]

    Card -->|Occupied| OccChoice{Action}
    OccChoice -->|Add time| Ext{Clashes with next booking?}
    Ext -->|Yes| ExtErr[Error toast: time not added]
    Ext -->|No| Extended[Duration extended] --> Occ
    OccChoice -->|Undo time| Undo[Remove added minutes] --> Occ
    OccChoice -->|End Session| EndModal[End Session warning<br/>shows played vs booked, total]
    EndModal -->|Confirm| Ended[Table: Available<br/>booking: Completed]
    Ended --> Bill[Table charge created<br/>toast: Open POS] --> POS[[Sales POS]]

    Occ --> Occupied2[Session running]
    Occupied2 -.->|time runs out| TimeUp[[Time's Up alert]]
```

## 3. Sales POS

```mermaid
flowchart TD
    POS[Sales POS] --> BillSel{Bill}
    BillSel -->|New| NewBill[Open new bill<br/>optional table / customer]
    BillSel -->|Existing| Switch[Switch to open bill]
    NewBill --> Cart
    Switch --> Cart

    Cart[Cart] --> AddProd[Add products from grid<br/>limited by stock]
    Cart --> AddCharge[Add unpaid table charge]
    AddProd --> Queue[Send order to queue<br/>stock deducted]
    Queue --> Serve[Mark items / ticket served]
    AddProd --> Cart
    AddCharge --> Cart

    Cart --> Pay[Process payment]
    Pay --> Method{Method}
    Method -->|Cash| Confirm[Payment confirmation]
    Method -->|GCash| Confirm
    Confirm --> Done[Transaction saved<br/>table charges marked paid<br/>audit log + admin notified]
    Done --> Receipt[Receipt modal<br/>print]
    Done --> History[Transaction history<br/>view past receipts]
```

## 4. Reservations Desk

```mermaid
flowchart TD
    RD[Reservations Desk] --> NewRes[New Reservation]
    NewRes --> Form[Customer, party size,<br/>date, time, hours, table]
    Form --> Valid{Valid and table free?}
    Valid -->|No| FormErr[Show error] --> Form
    Valid -->|Yes| Approved

    Online([Guest books online<br/>with GCash payment]) --> Pending[Booking: Pending]
    Pending --> Check[Payment check modal<br/>find GCash payment]
    Check -->|Payment found| Approved[Booking: Approved<br/>table reserved, admin notified]
    Check -->|Not found| Rejected[Booking: Rejected<br/>slot freed, admin notified]

    Approved --> Arrived[Mark Arrived<br/>within arrival window]
    Approved --> Assign
    Arrived --> Assign[Assign table<br/>Booking: Seated, table: Occupied]
    Assign --> Complete[Complete<br/>session ends, charge to Sales POS]

    Pending --> Cancel[Cancel]
    Approved --> Cancel
    Arrived --> Cancel
    Cancel --> Cancelled[Booking: Cancelled<br/>admin notified]

    Approved -.->|guest never shows| Expired[Booking: Expired]

    Complete --> Hist[(History)]
    Cancelled --> Hist
    Rejected --> Hist
    Expired --> Hist
```

## 5. Actions (tables and equipment)

```mermaid
flowchart TD
    QA[Actions page] --> Tbl[Table card]
    Tbl --> Status{Set status}
    Status --> Block{Occupied or Reserved?}
    Block -->|Yes| Blocked[Disabled: end session<br/>or handle booking first]
    Block -->|No| SetSt[Cleaning / Under maintenance /<br/>Ready for use] --> Log1[Audit log]

    Tbl --> Report[Report issue<br/>table or equipment item]
    Report --> RModal[Issue type, item, description,<br/>block table?]
    RModal --> BlocksTable{Blocks table and<br/>table not in play?}
    BlocksTable -->|Yes| Maint[Table: Under maintenance<br/>no online bookings]
    BlocksTable -->|No| Keep[Table status unchanged]
    Maint --> Sent[Issue sent to admin]
    Keep --> Sent

    QA --> Spare[Spare equipment]
    Spare --> Borrow[Lend item to table / customer] --> BLog[Borrow log]
    BLog --> Return{Return}
    Return -->|OK| Back[Back at counter]
    Return -->|Damaged| Dmg[Returned damaged<br/>reported to admin]
```

## 6. Tournament Schedule

```mermaid
flowchart TD
    TS[Tournament Schedule] --> List[Events from admin<br/>Upcoming / Ongoing / Completed / Cancelled]
    List --> Sel[Select event]
    Sel --> Details[Details: date, time, game type,<br/>fee, assigned tables, participants]
    Details --> Open{Accepting registration?<br/>upcoming or ongoing, not past}
    Open -->|No| Notice[Show cancelled / completed notice]
    Open -->|Yes| AddP[Register walk-in player]
    AddP --> Dup{Already registered?}
    Dup -->|Yes| DupErr[Show error]
    Dup -->|No| Saved[Player added to participants]

    Bell([Registration bell]) --> FocusPlayer[Open the player's tournament<br/>and highlight them] --> Details
```
