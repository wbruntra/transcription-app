gsettings get org.gnome.settings-daemon.plugins.media-keys custom-keybindings | tr -d "[]'," | tr ' ' '\n' | while read path; do
    if [ -n "$path" ]; then
        name=$(gsettings get org.gnome.settings-daemon.plugins.media-keys.custom-keybinding:$path name)
        command=$(gsettings get org.gnome.settings-daemon.plugins.media-keys.custom-keybinding:$path command)
        binding=$(gsettings get org.gnome.settings-daemon.plugins.media-keys.custom-keybinding:$path binding)
        echo "[$path]"
        echo "  Name: $name"
        echo "  Command: $command"
        echo "  Binding: $binding"
        echo ""
    fi
done