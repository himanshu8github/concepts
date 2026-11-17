Part 1: ACID Properties in MongoDB
In SQL, ACID is guaranteed by default for every transaction. In MongoDB, ACID is also guaranteed, but multi-document transactions were only introduced in version 4.0. Previously, MongoDB only guaranteed ACID for a single document.

Here is how MongoDB handles ACID today:

1. Atomicity (All or Nothing)
What it means: A transaction is treated as a single unit. Either all operations succeed, or none do. If any step fails, the database rolls back to the previous state.

SQL Example: Transferring $100 from Account A to B. You must deduct from A and add to B. If the server crashes after deducting from A, the whole transaction aborts, and A gets its money back.

MongoDB Example: Placing an order (deducting wallet points and creating an order). If the points are deducted but the order creation fails, the transaction rolls back.

MongoDB Code: Uses session.startTransaction() and session.commitTransaction().

2. Consistency (Valid Data Only)
What it means: Data written to the database must follow all defined rules (constraints, schemas, foreign keys). It moves the database from one valid state to another.

SQL Example: You have a UNIQUE constraint on email. If you try to insert a duplicate email, the database rejects it and throws an error.

MongoDB Example: You defined @Prop({ required: true, unique: true }) on the email field in your Mongoose schema. If you try to save a user without an email or with a duplicate email, MongoDB rejects the save operation. The database remains consistent.

3. Isolation (No Interference)
What it means: If two users are doing transactions at the same time, they should not see each other's uncommitted data. It prevents "dirty reads."

SQL Example: User A is buying the last ticket. User B is also trying to buy it. Isolation ensures they don't accidentally both get a ticket.

MongoDB Example: If User A is transferring points to User B, User B cannot query their balance and see the new points until User A's transaction is fully committed.

4. Durability (It's Saved Forever)
What it means: Once the database says "Success," the data is permanently saved, even if the server loses power a millisecond later.

SQL Example: You get a COMMIT success message. The data is written to the hard drive.

MongoDB Example: When save() returns successfully, the data is written to the WiredTiger storage engine's journal log (Write-Ahead Log) on disk.

Part 2: Which Databases DON'T Follow ACID or Indexing Rules?
It is important to know that every major database today supports ACID in some form, but they enforce it differently. There are two main database categories: Relational (SQL) and NoSQL.

1. Are there databases that don't follow ACID?
Yes, historically, many NoSQL databases (like early MongoDB, early Cassandra, DynamoDB) relaxed ACID for BASE (Basically Available, Soft state, Eventual consistency). They prioritized speed and availability over strict ACID.

MongoDB (Pre-v4.0): Before version 4.0, MongoDB only had Atomicity at the single document level. Multi-document transactions were not supported. This was a major limitation (and still is in some edge cases).

Cassandra: Uses "Eventual Consistency." If you write data, it might take a few milliseconds for all nodes in the cluster to see it. It does not guarantee immediate ACID isolation.

Redis: An in-memory database. It is very fast but its standard operations don't guarantee durability (if the server crashes before it saves to disk, data is lost).

DynamoDB (AWS): By default, it's eventually consistent. You have to pay extra for "Strongly Consistent Reads."

2. Which databases did NOT follow indexing rules? (And why?)
The "indexing rule" refers to the fact that databases must use an index to quickly find a document (B-Tree, Hash, etc.) rather than scanning every row (a COLLSCAN).

There are three main reasons a database would "ignore" an index:

The Query Doesn't Match the Index: If you have an index on name, but query WHERE age = 25, the database is forced to scan the whole table. (This is true for both SQL and MongoDB).

The Table is Too Small: If a collection only has 10 documents, scanning all 10 is faster than looking up the index. The database optimizer will ignore the index.

"Special" NoSQL Databases:

Redis: Does not use B-Tree indexes at all. It is a Key-Value store. You can only look up data by its exact key (like GET user:1000). If you want to find all users named "Himanshu", Redis has to scan everything unless you manually create a "Secondary Index" (like a Set or Sorted Set) yourself. Redis doesn't do it automatically.

HBase / Cassandra: These are designed for massive write throughput. They use LSM Trees (Log-Structured Merge Trees) rather than B-Trees. They rely heavily on the Primary Key (Partition Key). If you query on a non-partition key without an explicitly created secondary index, Cassandra will throw an error or perform a full cluster scan, which is extremely slow.