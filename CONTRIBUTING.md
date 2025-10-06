# Contributing to TutorHail Backend

## Branch Strategy

### Protected Branches
- **`main`**: Production-ready code only
- **`develop`**: Integration branch for features

### Workflow

1. **Create Feature Branch**
   ```bash
   git checkout develop
   git pull origin develop
   git checkout -b feature/your-feature-name
   ```

2. **Work on Your Feature**
   ```bash
   # Make your changes
   git add .
   git commit -m "feat: your feature description"
   git push origin feature/your-feature-name
   ```

3. **Create Pull Request**
   - Create PR from your feature branch to `develop`
   - Add proper description
   - Request review from team members
   - Wait for approval before merging

4. **After PR Approval**
   - PR will be merged into `develop`
   - Delete your feature branch
   ```bash
   git checkout develop
   git pull origin develop
   git branch -d feature/your-feature-name
   ```

## Branch Naming Convention

- **Feature branches**: `feature/feature-name`
- **Bug fixes**: `bugfix/issue-description`
- **Hotfixes**: `hotfix/critical-fix`
- **Release branches**: `release/v1.0.0`

## Commit Message Convention

- `feat:` New feature
- `fix:` Bug fix
- `docs:` Documentation changes
- `style:` Code style changes
- `refactor:` Code refactoring
- `test:` Adding tests
- `chore:` Maintenance tasks

## Code Review Requirements

- At least 1 approval required
- All conversations must be resolved
- Branch must be up to date with target branch
- No direct pushes to `main` or `develop`

## Getting Started

1. Clone the repository
2. Checkout develop branch: `git checkout develop`
3. Create your feature branch: `git checkout -b feature/your-feature`
4. Make changes and commit
5. Push and create PR to `develop`
