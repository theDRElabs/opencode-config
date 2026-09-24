# DataCheck keeps Room entities and WorkManager workers; keep default rules.

# WorkManager instantiates ListenableWorker subclasses reflectively via its
# WorkerFactory; keep the app's workers and their public constructors.
-keep class * extends androidx.work.ListenableWorker {
    public <init>(...);
}

# Room resolves the generated <Database>_Impl class via reflection; keep
# RoomDatabase subclasses and their constructors.
-keep class * extends androidx.room.RoomDatabase {
    <init>();
}

# Room maps columns to entity fields through generated mappers; keep annotated
# entities (class + field names) so column mapping survives R8 renaming.
-keep @androidx.room.Entity class * {
    <fields>;
}
