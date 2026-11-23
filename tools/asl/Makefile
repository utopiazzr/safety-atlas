# Common tasks. Run from tools/asl.
.PHONY: help test test-fast arch cases ci clean version

help:
	@echo "make test     - full suite (~45s)"
	@echo "make test-fast- scripts and unit tests only"
	@echo "make arch     - architecture layering only"
	@echo "make cases    - seed safety + determinism for every case"
	@echo "make ci       - what CI runs"
	@echo "make version  - print version"
	@echo "make clean    - remove caches"

test:
	python -m pytest tests -q

test-fast:
	python -m pytest tests -q -k "not oracle_determinism"

arch:
	python -m pytest tests/test_architecture.py -q

cases:
	python -m pytest tests/test_seed_safety.py tests/test_oracle_determinism.py -q

ci: test
	python asl.py --version
	python asl.py audit --list-cases

version:
	python asl.py --version

clean:
	rm -rf __pycache__ engine/__pycache__ tests/__pycache__ .pytest_cache pytest-of-root
