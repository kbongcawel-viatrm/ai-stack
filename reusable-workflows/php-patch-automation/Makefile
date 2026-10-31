.PHONY: install test lint typecheck validate discover-fixtures
install:
	python -m pip install --upgrade pip
	python -m pip install -e '.[dev,all-clouds]'
test:
	pytest --cov=php_patch --cov-report=term-missing
lint:
	ruff check .
	ruff format --check .
typecheck:
	mypy src
validate: lint typecheck test
discover-fixtures:
	php-patch inventory --source fixtures --format json
