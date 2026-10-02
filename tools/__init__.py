# Marks tools/ as a package so unittest can discover tests inside it.
#
# `python -m unittest discover -s tools` refuses a start directory that is not
# importable, and flyway_location_test imports flyway_migration_test by bare
# name, which needs tools/ on sys.path as a package rather than merely as a
# directory.
#
# The AGENTS.md and package.json scripts were both pointed at the old top-level
# location, so this file is what makes the moved tests runnable at all.
