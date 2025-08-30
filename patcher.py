import tkinter as tk
from tkinter import filedialog, messagebox
import json
import os
import textwrap

class PatcherApp:
    """A GUI application to apply JSON-based patches to a project,
       supporting both full file overwrites and targeted modifications."""

    def __init__(self, root):
        self.root = root
        self.root.title("Scanstation Project Patcher (v2)")
        self.root.geometry("700x550")

        path_frame = tk.Frame(self.root, pady=5)
        path_frame.pack(fill='x', padx=10)
        tk.Label(path_frame, text="Scanstation Project Path:", anchor='w').pack(side='left')
        self.path_var = tk.StringVar()
        self.path_entry = tk.Entry(path_frame, textvariable=self.path_var, state='readonly', bg='lightgrey')
        self.path_entry.pack(fill='x', expand=True, side='left', padx=5)
        self.browse_button = tk.Button(path_frame, text="Browse...", command=self.select_project_path)
        self.browse_button.pack(side='left')

        json_frame = tk.Frame(self.root, pady=5)
        json_frame.pack(fill='both', expand=True, padx=10)
        tk.Label(json_frame, text="Paste Patch JSON Here:", anchor='w').pack(fill='x')
        self.json_text = tk.Text(json_frame, wrap='word', height=15, undo=True)
        self.json_text.pack(fill='both', expand=True, pady=(5,0))

        action_frame = tk.Frame(self.root, pady=10)
        action_frame.pack(fill='x', padx=10)
        self.apply_button = tk.Button(action_frame, text="Apply Patch", font=('Helvetica', 10, 'bold'), bg='#4CAF50', fg='white', command=self.apply_patch)
        self.apply_button.pack(side='right', padx=5)
        self.status_var = tk.StringVar()
        self.status_var.set("Ready. Select project path and paste JSON.")
        self.status_label = tk.Label(action_frame, textvariable=self.status_var, fg='grey', anchor='w')
        self.status_label.pack(side='left', fill='x', expand=True)

    def select_project_path(self):
        directory = filedialog.askdirectory(title="Select Scanstation Project Folder")
        if directory:
            self.path_var.set(directory)
            self.status_var.set(f"Project path set to: {directory}")
            self.status_label.config(fg='black')

    def apply_patch(self):
        project_path = self.path_var.get()
        json_content = self.json_text.get("1.0", "end-1c")

        if not project_path or not os.path.isdir(project_path):
            messagebox.showerror("Error", "Please select a valid project path first.")
            return
            
        if not json_content.strip():
            messagebox.showerror("Error", "The JSON patch area is empty.")
            return

        try:
            patch_data = json.loads(json_content)
            
            # --- CHOOSE PATCHING STRATEGY ---
            if "files" in patch_data and isinstance(patch_data["files"], list):
                self._apply_modification_patch(project_path, patch_data["files"])
            else:
                self._apply_overwrite_patch(project_path, patch_data)

        except json.JSONDecodeError as e:
            messagebox.showerror("JSON Error", f"Invalid JSON format.\n\nDetails: {e}")
        except Exception as e:
            messagebox.showerror("Error", f"An unexpected error occurred.\n\nDetails: {e}")
            self.status_var.set("An error occurred. Check the error message.")
            self.status_label.config(fg='red')
            
    def _apply_overwrite_patch(self, project_path, patch_data):
        """Applies the patch by overwriting entire files (old method)."""
        self.status_var.set(f"Applying overwrite patch...")
        self.root.update_idletasks()
        
        for relative_path, content in patch_data.items():
            self._write_file(project_path, relative_path, content)

        messagebox.showinfo("Success", f"Overwrite patch applied!\n{len(patch_data)} file(s) were updated.")
        self.status_var.set("Successfully applied overwrite patch.")
        self.status_label.config(fg='green')

    def _apply_modification_patch(self, project_path, files_to_modify):
        """Applies the patch by finding and replacing text in files (new method)."""
        self.status_var.set(f"Applying modification patch...")
        self.root.update_idletasks()
        
        warnings = []
        for file_info in files_to_modify:
            relative_path = file_info['path']
            full_path = os.path.join(project_path, relative_path.replace('/', os.sep))

            if not os.path.exists(full_path):
                warnings.append(f"File not found, skipped: {relative_path}")
                continue

            with open(full_path, 'r', encoding='utf-8') as f:
                original_content = f.read()
            
            modified_content = original_content
            for mod in file_info['modifications']:
                find_text = textwrap.dedent(mod['find']).strip()
                replace_text = textwrap.dedent(mod['replace_with']).strip()

                if find_text not in modified_content:
                    warnings.append(f"'{find_text[:30]}...' not found in {relative_path}")
                else:
                    modified_content = modified_content.replace(find_text, replace_text)
            
            self._write_file(project_path, relative_path, modified_content, overwrite=True)
            
        final_message = f"Modification patch applied!\n{len(files_to_modify)} file(s) were processed."
        if warnings:
            final_message += "\n\nWarnings:\n- " + "\n- ".join(warnings)
        
        messagebox.showinfo("Success", final_message)
        self.status_var.set("Successfully applied modification patch.")
        self.status_label.config(fg='green')

    def _write_file(self, project_path, relative_path, content, overwrite=False):
        """Helper to safely write content to a file."""
        full_path = os.path.join(project_path, relative_path.replace('/', os.sep))
        os.makedirs(os.path.dirname(full_path), exist_ok=True)
        
        clean_content = content if overwrite else textwrap.dedent(content).strip()
        
        with open(full_path, 'w', encoding='utf-8') as f:
            f.write(clean_content)

def main():
    root = tk.Tk()
    app = PatcherApp(root)
    root.mainloop()

if __name__ == "__main__":
    main()