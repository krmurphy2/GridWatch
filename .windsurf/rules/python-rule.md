---
trigger: glob
description: Rules for Python code in this AI project repository.
globs: src/**/*.py, tests/**/*.py, **/*.py
---

## Python Rules

### Code Style
- Follow PEP 8 style guidelines
- Use type hints for function signatures and complex variables
- Maximum line length: 88 characters (Black default)
- Use descriptive variable and function names
- Prefer f-strings for string formatting

### Code Quality
- Always run `black` for formatting before committing
- Use `ruff` for linting and catching common issues
- Use `mypy` for type checking when applicable
- Keep functions focused and single-purpose
- Write docstrings for public functions and classes

### AI/ML Specific
- Document model choices and parameters
- Version control prompts and configurations
- Implement robust error handling for API calls
- Add retry logic with exponential backoff for external APIs
- Log API usage for cost tracking and debugging

### Security & Secrets
- Never hardcode API keys or credentials
- Use environment variables for sensitive config
- Use `python-dotenv` for local development
- Validate and sanitize all external inputs
- Implement rate limiting for API calls

### Testing
- Write tests for core functionality
- Test edge cases and error conditions
- Mock external API calls in tests
- Use pytest for test framework
- Aim for meaningful test coverage

### Dependencies
- Pin dependency versions in `requirements.txt`
- Document why specific versions are required
- Keep dependencies minimal and justified
- Regularly update dependencies for security

### Error Handling
- Use specific exception types
- Provide helpful error messages
- Log errors with context
- Implement graceful degradation for AI services
- Handle API rate limits and timeouts
