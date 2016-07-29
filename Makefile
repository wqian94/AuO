MAIN_REMOTE := github
MAIN_BRANCH := master
SUBTREE_REMOTE := github
SUBTREE_BRANCH := gh-pages
MIT_REMOTE := mit
MIT_BRANCH := master

STAGE_BRANCH := make-stage

MUTE := 2>/dev/null 1>/dev/null

all:
	@printf "\033[1;34mRunning pre-push checks...\033[m"
	@check_branch=$$(git rev-parse --verify --quiet $(STAGE_BRANCH)); if [ -n "$$check_branch" ]; then printf "\033[1;31mTemporary branch $(STAGE_BRANCH) already exists. Please remove the branch with \`git branch -D $(STAGE_BRANCH)\` and try again.\n\033[m"; exit 1; fi
	@git checkout -b $(STAGE_BRANCH) $(MUTE); git commit --allow-empty -m 'staged' $(MUTE); git commit --allow-empty -am 'unstaged' $(MUTE); jekyll build $(MUTE); diff=$$(git diff); quit=0; if [ -n "$$diff" ]; then printf "\033[1;31mYou need to rebuild Jekyll and commit the changes!\n\033[m"; quit=1; fi; git reset --hard $(MUTE); git checkout $(MAIN_BRANCH) $(MUTE); git cherry-pick $(STAGE_BRANCH) -n $(MUTE); git reset $(MUTE); git cherry-pick $(STAGE_BRANCH)^ -n $(MUTE); git branch -D $(STAGE_BRANCH) $(MUTE); if [ $$quit -eq 1 ]; then exit 1; fi
	@printf "\033[1;32mPre-push checks passed.\n\033[m"
	@echo "\033[1;34mAbout to push commit(s):\033[m"
	@git log --oneline $(MAIN_REMOTE)/$(MAIN_BRANCH)..
	@read -p "Proceed? [Y/n] << " confirm; if [ "$$confirm" != y ] && [ "$$confirm" != Y ]; then echo "\033[1;31mAborting push.\033[m"; exit 1; fi
	@echo "\033[0;32mProceeding.\033[m"
	@echo "\033[1;34mPushing _site subtree to $(SUBTREE_REMOTE)/$(SUBTREE_BRANCH).\033[m"
	@git subtree push --prefix _site $(SUBTREE_REMOTE) $(SUBTREE_BRANCH)
	@echo "\033[1;34mPushing to $(MIT_REMOTE)/$(MIT_BRANCH).\033[m"
	@git push $(MIT_REMOTE) $(MIT_BRANCH)
	@echo "\033[1;34mPushing repository tree to $(MAIN_REMOTE)/$(MAIN_BRANCH).\033[m"
	@git push $(MAIN_REMOTE) $(MAIN_BRANCH)

v%:
	@if git rev-parse -q --verify $@; then git push $(MAIN_REMOTE) :$@; git push $(MIT_REMOTE) :$@; fi
	@git tag -af $@ && git push $(MAIN_REMOTE) $@ && git push $(MIT_REMOTE) $@

subtree: subtree-master

subtree-%:
	@git push github `git subtree split --prefix _site $*`:gh-pages --force
