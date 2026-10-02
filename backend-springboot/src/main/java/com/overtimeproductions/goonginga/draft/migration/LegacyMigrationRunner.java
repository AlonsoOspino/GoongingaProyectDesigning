package com.overtimeproductions.goonginga.draft.migration;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.CommandLineRunner;
import org.springframework.stereotype.Component;
import tools.jackson.databind.ObjectMapper;

/** Same importer as the admin API, available to deployment jobs without a user token. */
@Component
public class LegacyMigrationRunner implements CommandLineRunner {
    private final LegacyDraftMigrationService migration;
    private final ObjectMapper json;
    private final String mode;
    private final boolean requireImport;
    public LegacyMigrationRunner(LegacyDraftMigrationService migration,ObjectMapper json,@Value("${migration.mode:off}") String mode,@Value("${migration.require-import:true}") boolean requireImport) {
        this.migration=migration;this.json=json;this.mode=mode;
        this.requireImport=requireImport;
    }
    @Override public void run(String... args) {
        if(mode.equals("off")) {
            if(requireImport) {
                var report=migration.review();
                if(report.ready()>0||report.blocked()>0)throw new IllegalStateException("Complete the legacy draft import before starting Java: "+json.writeValueAsString(report));
            }
            return;
        }
        if(!mode.equals("check")&&!mode.equals("apply"))throw new IllegalArgumentException("migration.mode must be off, check or apply.");
        var report=migration.review();
        System.out.println("LEGACY_DRAFT_REVIEW "+json.writeValueAsString(report));
        if(report.blocked()>0)throw new IllegalStateException("Migration blocked by "+report.blocked()+" draft records. Review the report before cutover.");
        if(mode.equals("apply"))System.out.println("LEGACY_DRAFT_IMPORTED "+json.writeValueAsString(migration.apply()));
    }
}
