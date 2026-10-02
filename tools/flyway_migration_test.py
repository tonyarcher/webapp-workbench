"""Fail when an applied Flyway migration is edited or deleted on this branch.

Flyway records a checksum for every migration it applies, and the checksum covers
the entire file, comments included. A database therefore remembers the exact
bytes of every migration it has run, and when the branch stops matching, the
application refuses to start:

  Validate failed: Migrations have failed validation
  Migration checksum mismatch for migration version 14
  -> Applied to database : -2117779632
  -> Resolved locally    : 2103240093

That failure is not local to a migration. user-api could not bind its port, so
the gateway returned 502 for every path under /user-api/ and the container
restarted forever. Two independent causes, both already applied by production and
no longer satisfied by this branch:

  * commit 553cd25 reworded the comments inside the applied
    V14__auth_code_nonce.sql, and a checksum covers comments;
  * V13 and V15 were absent from the branch, so Flyway could not resolve
    migrations its database had recorded.

Hence two checks, because the halves fail in opposite ways: one watches a file
whose bytes changed, the other watches a name that vanished. The first version
had only the byte check and was blind to deletion for a reason worth recording --
a scan that reads files on disk sees nothing when the file it should be watching
is missing, which is the case it most needed to catch.

Neither check reimplements Flyway's CRC32; both compare git objects, so neither
needs a database or a build of the service.

KNOWN_BASELINE records the five migrations a 2026-09-23 formatter sweep had
already edited before any deployment applied them. Each is pinned to the blob it
had, not skipped, so a file passes if its bytes match either its introducing
commit or its pin. Anything else fails. A plain skip would have left live
production migrations permanently unguarded while claiming the opposite.

The comparison is a superset of the dangerous case: it cannot tell an edit made
before any database applied a file, which is harmless, from one made after, which
is an outage. It also needs full history, since on a shallow clone every add
resolves to the boundary commit and both checks would pass without inspecting
anything. That is asserted rather than assumed.

Config parsing lives in flyway_location_test.py, which shares the constants here.

Run: python3 -m unittest discover -s tools -t . -p "*_test.py".
Only stdlib is used (pathlib, re, subprocess, tempfile, unittest).
"""

from __future__ import annotations

import pathlib
import re
import subprocess
import tempfile
import unittest
from collections.abc import Mapping

ROOT = pathlib.Path(__file__).resolve().parent.parent

# V14__auth_code_nonce.sql. A version, then the double underscore Flyway requires,
# then a description that cannot be empty. Underscores separate version parts, so
# V14_1__hotfix.sql is version 14.1 and is a legal name.
MIGRATION = re.compile(r"^V\d+(?:_\d+)*__.+\.sql$")

# Matched as two consecutive path parts, because a relative path splits them, and
# as exact parts rather than a substring, so otherdb/migration or db/migrations
# cannot masquerade as the directory the scan actually reads.
MIGRATION_DIR = ("db", "migration")

# Gradle copies every migration into build/resources/main/db/migration, and
# node_modules carries another set, so without this the scan sees each file twice
# and the untracked copies have no history to compare against.
SKIP_DIRS = frozenset(
    {".git", ".gradle", "build", "coverage", "dist", "node_modules", "out", "target"}
)

# Below this the scan is probably walking nothing and passing vacuously. The
# tree holds 29; the slack tolerates removing a small app without a false alarm.
MIN_MIGRATIONS = 25

GIT_IDENTITY = ("-c", "user.email=test@example.invalid", "-c", "user.name=Test")

# Migrated files, pinned to the blob each had when it was recorded.
#
# All five were rewritten by commit a89834b, the 2026-09-23 formatter sweep, which
# ran before any deployment applied them. That was not assumed: all four owning
# services were observed starting against production with zero Flyway findings,
# and production can only start clean if the bytes it recorded are the bytes at
# HEAD. fitness-api and stock-game-api answered healthz 200 at the time.
#
# V6__oauth_clients.sql and V7__stock_game_client.sql are applied user-api
# migrations whose recorded checksums match the blobs pinned below, so these are
# live production files. That is why the pin is a blob and not a skip: editing
# either now reproduces the outage, and the guard has to catch it.
KNOWN_BASELINE: dict[str, str] = {
    "apps/fitness/api/src/main/resources/db/migration/V2__energy_total.sql": (
        "564796d9db276e1b4ed68b1ed51122e003c28bcc"
    ),
    "apps/rss/api/src/main/resources/db/migration/V3__identity_and_pool.sql": (
        "c773eadf39abb50a31b3d9b338eadc95c39a91d4"
    ),
    "apps/stock-game/api/src/main/resources/db/migration/V1__schema.sql": (
        "9bbeacaed2c89a34cfe66fc8e860badf6b81840f"
    ),
    "apps/user/api/src/main/resources/db/migration/V6__oauth_clients.sql": (
        "930f193698a26e2cb3420e77b7d5d9e33e558da1"
    ),
    "apps/user/api/src/main/resources/db/migration/V7__stock_game_client.sql": (
        "87b3b321e43acf3d38b6b5ceb8d8efcd141c4aec"
    ),
}


def git(*args: str, cwd: pathlib.Path) -> str:
    """Run git and return stdout, raising on failure."""
    done = subprocess.run(
        ["git", *args],
        cwd=cwd,
        capture_output=True,
        text=True,
        check=True,
        encoding="utf-8",
        errors="replace",
    )
    return done.stdout


def blob_at(root: pathlib.Path, ref: str, rel: str) -> str | None:
    """The blob object id a ref held for a path, or None if absent there."""
    done = subprocess.run(
        ["git", "rev-parse", "--verify", "--quiet", f"{ref}:{rel}"],
        cwd=root,
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
        # A path absent from that ref exits nonzero, which is a normal answer
        # here rather than a failure, so the status is inspected instead.
        check=False,
    )
    return done.stdout.strip() or None


def in_migration_dir(parts: tuple[str, ...]) -> bool:
    """True when these path parts run through db/migration.

    Exact consecutive parts, so otherdb/migration and db/migrations are both
    rejected. A location that merely contains the substring would send the scan
    looking somewhere these checks never read.
    """
    return any(parts[i : i + 2] == MIGRATION_DIR for i in range(len(parts) - 1))


def ascii_safe(text: str) -> str:
    """Replace anything the Windows console cannot encode.

    A crash here would fail the suite on the very file it is reporting, which is
    the worst outcome for a check meant to explain itself.
    """
    return text.encode("ascii", "replace").decode("ascii")


def migration_files(root: pathlib.Path) -> list[pathlib.Path]:
    """Every tracked-source Flyway migration under the tree, sorted.

    Walks rather than globs, so generated directories are pruned instead of
    filtered out afterwards.
    """
    found: list[pathlib.Path] = []
    for path in root.rglob("*.sql"):
        parts = path.relative_to(root).parts
        if SKIP_DIRS.intersection(parts):
            continue
        if MIGRATION.match(path.name) and in_migration_dir(parts):
            found.append(path)
    return sorted(found)


def introducing_commit(root: pathlib.Path, path: pathlib.Path) -> str | None:
    """The oldest commit that added this path, or None if it is untracked.

    git log reports newest first, so the last entry is the introduction. A file
    added, deleted and re-added reports several; the oldest is still the commit
    whose bytes a database could have recorded.
    """
    rel = path.relative_to(root).as_posix()
    log = git("log", "--diff-filter=A", "--format=%H", "--", rel, cwd=root)
    adds = [line.strip() for line in log.splitlines() if line.strip()]
    return adds[-1] if adds else None


def edited_after_introduction(
    root: pathlib.Path, baseline: Mapping[str, str] | None = None
) -> list[tuple[str, str, str]]:
    """Migrations whose bytes match neither their introduction nor their pin.

    Returns (path, introducing blob, current blob). A file is fine when it still
    matches the commit that introduced it, which is why a reverted edit passes,
    and when it matches its baseline pin, which is what keeps the five
    formatter-sweep files tolerated without leaving them unguarded.
    """
    pinned = baseline or {}
    violations: list[tuple[str, str, str]] = []
    for path in migration_files(root):
        added = introducing_commit(root, path)
        if added is None:
            continue  # untracked: applied nowhere
        rel = path.relative_to(root).as_posix()
        then = blob_at(root, added, rel)
        # Comparing raw worktree bytes is safe because .gitattributes pins
        # "*.sql text eol=lf", so a checkout is always LF and always matches the
        # stored blob. Flyway also normalises line endings before checksumming, so
        # the two agree about what counts as a change.
        now = git("hash-object", "--", rel, cwd=root).strip()
        if then is None or now in {then, pinned.get(rel)}:
            continue
        violations.append((rel, then[:12], now[:12]))
    return violations


def baselined_names(baseline: Mapping[str, str] | None) -> set[str]:
    """The migration filenames the baseline covers, whatever path they live at.

    Removal is detected by name, so the baseline has to be addressable by name
    too. Without this, the remediation printed on a removal failure could not be
    carried out.
    """
    return {pathlib.PurePosixPath(rel).name for rel in (baseline or {})}


def removed_after_introduction(
    root: pathlib.Path, baseline: Mapping[str, str] | None = None
) -> list[str]:
    """Migration names once committed here that git no longer tracks anywhere.

    Matched by filename rather than path, because the 2026-09-16 restructure moved
    every API module from apps/<app>-api/ to apps/<app>/api/. That reads as a
    delete followed by an add, and reporting all sixteen would bury the signal.
    A name git still tracks has moved, not gone.

    Presence is read from what git tracks, not from the working tree. The two
    differ exactly when it matters: a migration deleted from disk but still
    staged is one commit away from an outage, so the committed view is the honest
    one. Reading the working tree instead would let a stray untracked copy mask
    the fact that the branch no longer carries the file.
    """
    log = git(
        "log",
        "--diff-filter=A",
        "--name-only",
        "--format=",
        "--",
        ":(glob)**/db/migration/V*__*.sql",
        cwd=root,
    )
    ever = {
        line.strip().rsplit("/", 1)[-1] for line in log.splitlines() if line.strip()
    }
    listed = git("ls-files", "--", ":(glob)**/db/migration/V*__*.sql", cwd=root)
    present = {
        line.strip().rsplit("/", 1)[-1] for line in listed.splitlines() if line.strip()
    }
    skip = baselined_names(baseline)
    return sorted(name for name in ever - present if name not in skip)


class FlywayMigrationImmutabilityTest(unittest.TestCase):
    def test_history_is_complete(self) -> None:
        """Both checks need real history, so a shallow clone must not pass.

        On a shallow clone every --diff-filter=A resolves to the boundary commit,
        so a migration looks introduced by the tip commit and both checks pass
        without ever inspecting a past edit or deletion. A green light meaning
        nothing is worse than a failure.
        """
        shallow = git("rev-parse", "--is-shallow-repository", cwd=ROOT).strip()
        self.assertEqual(
            "false",
            shallow,
            "this is a shallow clone; both checks need full history to mean "
            "anything (fetch with --unshallow)",
        )

    def test_no_migration_edited_after_introduction(self) -> None:
        """A migration's bytes must be frozen once a database has applied them.

        Flyway checksums the whole file, comments included, so an edit here
        invalidates the checksum on every database that applied it and stops the
        service starting.
        """
        violations = edited_after_introduction(ROOT, KNOWN_BASELINE)
        if violations:
            print("\n" + "=" * 78)
            print(f"ERROR: {len(violations)} migration(s) edited after the commit")
            print("       that introduced them:")
            for rel, then, now in violations:
                print(f"  {rel}")
                print(f"      introduced as {then}, now {now}")
            print("Flyway checksums the whole file, comments included, so this")
            print("invalidates the checksum on every database that applied it and")
            print("stops the service from starting.")
            print("Write a new migration instead of editing an applied one.")
            print("=" * 78 + "\n")
        self.assertEqual(
            [],
            [ascii_safe(v[0]) for v in violations],
            "an applied Flyway migration was edited; write a new migration instead",
        )

    def test_no_migration_removed_after_introduction(self) -> None:
        """A migration that was applied must not disappear from the branch.

        V13 and V15 both reached production and are absent from this branch today.
        Flyway cannot resolve a migration its database has recorded, so it refuses
        to start and the service behind the gateway goes down.
        """
        removed = removed_after_introduction(ROOT, KNOWN_BASELINE)
        if removed:
            print("\n" + "=" * 78)
            print(f"ERROR: {len(removed)} migration(s) were committed here and are")
            print("       now gone:")
            for name in removed:
                print(f"  {name}")
            print("If a database applied one of these, Flyway cannot resolve it")
            print("and will refuse to start. Restore the file. If it was deleted on")
            print("purpose, add it to KNOWN_BASELINE with its current blob.")
            print("=" * 78 + "\n")
        self.assertEqual(
            [],
            [ascii_safe(n) for n in removed],
            "a committed Flyway migration is missing; restore it or baseline it",
        )

    def test_baseline_entries_are_all_live(self) -> None:
        """Every baseline path must exist, be committed, and still match its pin.

        A stale entry is dead weight that would quietly exempt a future file
        reusing the name. The pins are asserted to match, because that is what
        makes the baseline a pin rather than a hole: a live production migration
        edited today must fail. A file legitimately restored to its introducing
        bytes is handled by the edit check instead, which accepts either blob.
        """
        files = {p.relative_to(ROOT).as_posix() for p in migration_files(ROOT)}
        for rel, pin in KNOWN_BASELINE.items():
            with self.subTest(rel=rel):
                self.assertIn(rel, files, f"{rel} is not a migration in the tree")
                self.assertTrue(blob_at(ROOT, "HEAD", rel), f"{rel} is not committed")
                self.assertEqual(
                    pin,
                    git("hash-object", "--", rel, cwd=ROOT).strip(),
                    f"baseline pin for {rel} no longer matches the file",
                )
        # The baseline must also be addressable by name, since removal is
        # detected by name; otherwise the remediation printed on a removal
        # failure could not be carried out.
        for rel in KNOWN_BASELINE:
            self.assertIn(
                pathlib.PurePosixPath(rel).name, baselined_names(KNOWN_BASELINE)
            )

    def test_scan_is_not_vacuous(self) -> None:
        """Pin the scan and prove it can actually fail.

        The count catches the source roots moving and the regex assertions catch
        the pattern drifting. A real repository built here catches the git
        plumbing quietly returning nothing: one that adds a migration and then
        edits, moves, unstages and deletes it.
        """
        files = migration_files(ROOT)
        self.assertGreaterEqual(
            len(files),
            MIN_MIGRATIONS,
            f"only {len(files)} migrations found; the walk is broken",
        )
        self.assertFalse(
            [p for p in files if SKIP_DIRS.intersection(p.relative_to(ROOT).parts)],
            "a generated directory leaked into the scan",
        )
        for good in (
            "V1__pgcrypto.sql",
            "V15__wiki_gateway_hostname.sql",
            "V14_1__hotfix.sql",
        ):
            self.assertTrue(MIGRATION.match(good), f"rejected valid migration {good}")
        for bad in ("pgcrypto.sql", "V1_pgcrypto.sql", "V__pgcrypto.sql", "V1__.sql"):
            self.assertIsNone(MIGRATION.match(bad), f"accepted invalid name {bad}")

        with tempfile.TemporaryDirectory() as tmp:
            repo = pathlib.Path(tmp)
            git(*GIT_IDENTITY, "init", "--quiet", cwd=repo)
            migration = repo.joinpath("src", "main", "resources", *MIGRATION_DIR)
            migration.mkdir(parents=True)
            target = migration / "V1__thing.sql"
            rel = target.relative_to(repo).as_posix()

            def commit(message: str) -> None:
                git("add", "-A", ".", cwd=repo)
                git(*GIT_IDENTITY, "commit", "--quiet", "-m", message, cwd=repo)

            target.write_text("-- original\nSELECT 1;\n", encoding="utf-8")
            commit("add V1")
            self.assertEqual(
                [],
                edited_after_introduction(repo),
                "an untouched migration was flagged",
            )
            self.assertEqual(
                [],
                removed_after_introduction(repo),
                "a live migration was reported gone",
            )

            # Comment-only, exactly the change that took production down.
            target.write_text("-- reworded\nSELECT 1;\n", encoding="utf-8")
            commit("reword V1")
            edited = edited_after_introduction(repo)
            self.assertEqual(1, len(edited), "a comment-only edit was not detected")
            self.assertIn("V1__thing.sql", edited[0][0])

            # A pin tolerates the historical edit it was recorded for, and
            # nothing after it. This is what keeps a baseline from being a hole.
            reworded = git("hash-object", "--", rel, cwd=repo).strip()
            self.assertEqual(
                [],
                edited_after_introduction(repo, {rel: reworded}),
                "a matching pin did not tolerate a known edit",
            )
            target.write_text("-- reworded again\nSELECT 1;\n", encoding="utf-8")
            commit("reword V1 twice")
            self.assertEqual(
                1,
                len(edited_after_introduction(repo, {rel: reworded})),
                "an edit after the pin was not caught, so the pin is a hole",
            )

            # Restoring the original bytes clears it, because production's
            # recorded checksum matches the original again.
            target.write_text("-- original\nSELECT 1;\n", encoding="utf-8")
            commit("revert V1")
            self.assertEqual(
                [],
                edited_after_introduction(repo),
                "a reverted migration was still flagged",
            )

            # Now the other half of the outage: the file vanishing. Moving it
            # must stay quiet, because the 2026-09-16 restructure moved every
            # module and a path-based check would drown in sixteen false hits.
            moved = repo.joinpath("moved", "api", "resources", *MIGRATION_DIR)
            moved.mkdir(parents=True)
            (moved / "V1__thing.sql").write_text(
                "-- original\nSELECT 1;\n", encoding="utf-8"
            )
            git("rm", "--quiet", rel, cwd=repo)
            commit("move V1")
            self.assertEqual(
                [],
                removed_after_introduction(repo),
                "a relocated migration was reported removed",
            )

            # Removing it for good is the V13 and V15 shape, and must fail.
            (moved / "V1__thing.sql").unlink()
            commit("drop V1")
            self.assertIn(
                "V1__thing.sql",
                removed_after_introduction(repo),
                "a deleted migration was not reported",
            )
            self.assertEqual(
                [],
                removed_after_introduction(repo, {rel: reworded}),
                "baseline did not suppress a known removal",
            )

            # Unstaged, so the working tree and the index disagree. The file is
            # gone from disk yet still staged, one commit away from an outage, so
            # it must not read as present. Reading the working tree instead of
            # what git tracks would pass this.
            (moved / "V1__thing.sql").write_text(
                "-- original\nSELECT 1;\n", encoding="utf-8"
            )
            git("add", "-A", ".", cwd=repo)
            moved_rel = (moved / "V1__thing.sql").relative_to(repo).as_posix()
            git("rm", "--quiet", "--cached", moved_rel, cwd=repo)
            self.assertTrue((repo / moved_rel).is_file(), "precondition: still on disk")
            self.assertIn(
                "V1__thing.sql",
                removed_after_introduction(repo),
                "a migration unstaged but still on disk was reported as present",
            )


if __name__ == "__main__":
    unittest.main()
