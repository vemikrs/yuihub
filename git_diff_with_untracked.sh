git ls-files --others --exclude-standard -z | xargs -0 -I{} git add -N "{}" && git diff > .diff
