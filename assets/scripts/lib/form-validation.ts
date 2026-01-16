type FormField = HTMLInputElement | HTMLSelectElement;

export class FormValidator {
    private form: HTMLFormElement;
    private fields: NodeListOf<FormField>;
    private optionalFieldContainers: NodeListOf<HTMLElement>;
    private optionalRequireCheckboxes: HTMLInputElement[];
    private optionalRequiredGroups: Record<string, boolean> = {};

    constructor(form: HTMLFormElement) {
        this.form = form;
        this.fields = this.form.querySelectorAll("input[required], select[required]");
        this.optionalFieldContainers = this.form.querySelectorAll("[data-optional-group-container]");
        this.optionalRequireCheckboxes = [...this.form.querySelectorAll('input[data-optional-check="true"]')] as HTMLInputElement[];

        this.initOptionalGroups();
        this.attachFieldListeners();
    }

    private initOptionalGroups() {
        this.optionalRequireCheckboxes.forEach(checkbox => {
            const requiredState = checkbox.dataset.requiredState === "true";
            this.optionalRequiredGroups[checkbox.id] = checkbox.checked === requiredState;

            checkbox.addEventListener("change", (e) => {
                const input = e.target as HTMLInputElement;
                const requiredState = input.dataset.requiredState === "true";
                this.optionalRequiredGroups[input.id] = input.checked === requiredState;
                this.toggleOptionalFields(input.id, this.optionalRequiredGroups[input.id]);
            });
        });
    }

    private attachFieldListeners() {
        [...this.fields].forEach((field) => {
            if (field.dataset.validationChecklist) {
                field.addEventListener("keyup", (e) => this.updateValidationChecklist(e.target as HTMLInputElement));
            }
            field.addEventListener("blur", (e) => this.updateFieldState(e.target as FormField));
            field.addEventListener("focus", (e) => this.clearValidation(e.target as FormField));
        });
    }

    private toggleOptionalFields(group: string, visible: boolean) {
        [...this.optionalFieldContainers].forEach(container => {
            if (container.dataset.optionalGroupContainer === group) {
                container.classList.toggle("hidden", !visible);
            }
        });
    }

    public clearValidation(field: FormField) {
        const errorElement = document.getElementById(`${field.id}-error`);
        if (errorElement) errorElement.innerText = "";
        field.setAttribute("aria-invalid", "false");
        if (field.dataset.hasDescription === "true") {
            field.setAttribute("aria-describedby", `${field.id}-descr`);
        }
    }

    public setValidation(field: HTMLElement, msg: string) {
        const errorElement = document.getElementById(`${field.id}-error`);
        if (errorElement) errorElement.innerText = msg;
        field.setAttribute("aria-invalid", "true");
        if (field.dataset.hasDescription === "true") {
            field.setAttribute("aria-describedby", `${field.id}-error ${field.id}-descr`);
        } else {
            field.setAttribute("aria-describedby", `${field.id}-error`);
        }
    }

    public setValidationErrors(errorFields: Record<string, string>) {
        [...this.fields].forEach((field) => {
            const error = errorFields[field.id];
            if (error) {
                this.setValidation(field, error);
            } else {
                this.clearValidation(field);
            }
        });
    }

    private updateValidationChecklist(field: FormField) {
        const ul = document.getElementById(`${field.id}-validation-checklist`);
        if (!ul) return;
        const items = ul.querySelectorAll("li");
        [...items].forEach(item => {
            if (item.dataset.regex) {
                const regex = new RegExp(item.dataset.regex.replace(/^\/|\/$/g, ""));
                const valid = regex.test(field.value);
                item.dataset.checked = String(valid);
            }
        });
    }

    private updateFieldState(field: FormField) {
        const { valid, msg } = this.validateField(field);
        if (valid) {
            this.clearValidation(field);
        } else {
            this.setValidation(field, msg);
        }
    }


    public validateField(field: FormField): { valid: boolean; msg: string } {
        if (field.dataset.optionalRequiredGroup) {
            const required = this.optionalRequiredGroups[field.dataset.optionalRequiredGroup];
            if (!required) return { valid: true, msg: "" };
        }

        const isValid = field.dataset.pattern
            ? new RegExp(field.dataset.pattern.replace(/^\/|\/$/g, "")).test(field.value)
            : field.validity.valid;

        return {
            valid: isValid,
            msg: isValid ? "" : field.dataset.errorMessage || "Not valid",
        };
    }

    public validateAll(): {valid: boolean, invalidFields: HTMLElement[]} {
        let valid = true;
        const invalidFields: HTMLElement[] = [];
        [...this.fields].forEach(field => {
            const result = this.validateField(field);
            if (!result.valid) {
                valid = false;
                this.setValidation(field, result.msg);
                invalidFields.push(field);
            } else {
                this.clearValidation(field);
            }
        });
        return {valid, invalidFields};
    }

    public validateFieldById(id: string): boolean {
        const field = this.form.querySelector(`#${id}`) as FormField;
        if (!field) return false;
        const result = this.validateField(field);
        result.valid ? this.clearValidation(field) : this.setValidation(field, result.msg);
        return result.valid;
    }

    public getFormData(): Record<string, any> {
        return Object.fromEntries(new FormData(this.form));
    }
}






export const validateForm = (formId: string, submit: Function) => {
    const form = document.getElementById(formId)! as HTMLFormElement;
    const submitButton = document.getElementById(`${formId}-submit`)! as HTMLButtonElement;
    const fields = form!.querySelectorAll("input[required], select[required]") as NodeListOf<FormField>;
    const optionalFieldContainers = form.querySelectorAll("[data-optional-group-container]") as NodeListOf<HTMLElement>;
    let isSubmitting = false;
    const optionalRequireCheckboxes = [...form.querySelectorAll('input[data-optional-check="true"]')] as HTMLInputElement[];
    const optionalRequiredGroups = Object.assign({}, ...optionalRequireCheckboxes
        .map(target => {
            // when the check is checked, but requiredState is false, this means the fields with the same optionalRequiredGroup are not required
            const requiredState = target.dataset.requiredState === "true" ? true : false;
            return {[target.id]: target.checked == requiredState}
        })
    );
    optionalRequireCheckboxes.forEach(checkbox => {
        checkbox.addEventListener("change", ({target}) => {
            const input = target as HTMLInputElement;
            const requiredState = input.dataset.requiredState === "true" ? true : false;
            optionalRequiredGroups[input.id] = (input.checked == requiredState );

            toggleOptionalFields(input.id, optionalRequiredGroups[input.id]);
        });
    });
    
    [...fields].forEach((field) => {
        if (field.dataset.validationChecklist) {
            field.addEventListener("keyup", (e) => {
                updateValidationChecklist(e.target as FormField);
            });
        }
        // field.addEventListener("change", ({target}) => {
        //     updateFieldState(target)
        // });
        field.addEventListener("blur", ({target}) => {
            updateFieldState(target as HTMLInputElement | HTMLSelectElement)
        });
        field.addEventListener("focus", ({target}) => {
            clearValidation(target as HTMLInputElement | HTMLSelectElement)
        });
    })

    const toggleOptionalFields = (group: string, visible: boolean) => {
        [...optionalFieldContainers].forEach((container) => {
            if (container.dataset.optionalGroupContainer === group) {
                container.classList.toggle("hidden", !visible);
            }
        })
    }

    const clearValidation = (field: HTMLElement) => {
        const errorElement = document.getElementById(`${field.id}-error`)
        if (errorElement) errorElement.innerText = "";
        field.setAttribute("aria-invalid", "false");
        if (field.dataset.hasDescription === "true") field.setAttribute("aria-describedby", `${field.id}-descr`);
    }
    const setValidation = (field: HTMLElement, msg: string) => {
        const errorElement = document.getElementById(`${field.id}-error`)
        if (errorElement) errorElement.innerText = msg;
        field.setAttribute("aria-invalid", "true");
        if (field.dataset.hasDescription === "true") {
            field.setAttribute("aria-describedby", `${field.id}-error ${field.id}-descr`);
        } else {
            field.setAttribute("aria-describedby", `${field.id}-error`);
        }
    }
    const updateValidationChecklist = (field: FormField) => {
        const ul = document.getElementById(`${field.id}-validation-checklist`);
        if (ul) {
            const items = ul.querySelectorAll("li");
            [...items].forEach((item) => {
                if (item.dataset.regex) {
                    const regex = new RegExp(item.dataset.regex.replace(/^\/|\/$/g, ""));
                    const valid = regex.test(field.value);
                    item.dataset.checked = valid ? "true" : "false";
                }
            })
        }
    }

    const validateField = (field: HTMLInputElement | HTMLSelectElement): {valid: boolean, msg: string} => {
        // check optional required field
        if (field.dataset.optionalRequiredGroup) {
            const required = optionalRequiredGroups[field.dataset.optionalRequiredGroup];
            if (required === undefined || required == false) {
                return {
                    valid: true,
                    msg: "",
                }
            }
        }
        let valid = false;
        if (field.dataset.pattern) {
            valid = new RegExp(field.dataset.pattern.replace(/^\/|\/$/g, "")).test(field.value);
        } else {
            valid = field.validity.valid;
        }

        return {
            valid: valid,
            msg: valid ? "" : field.dataset.errorMessage || "Not valid",
        }
    }
    

    const updateFieldState = (field: HTMLInputElement | HTMLSelectElement) => {
        const {valid, msg} = validateField(field);
        if (valid) {
            clearValidation(field);
        }
        else {
            setValidation(field, msg);
        }
    }
    
    const handleFormSubmit = async (event: Event) => {
        event.preventDefault(); // avoid native form submit (page refresh)

        let errorFields: HTMLElement[] = [];
        [...fields].forEach((field) => {
            const {valid, msg} = validateField(field);
            if (!valid) {
                errorFields.push(field);

                setValidation(field, msg);
            }
        })
        
        if (errorFields.length > 0) {
            //focus first error field
            // errorFields[0].focus();
            return;
        }

        if (isSubmitting) {
            console.log("Double submit prevented");
            return;
        }

        isSubmitting = true;

        // feedback.innerText = "";
        submitButton.dataset.loading = String(true);
        submitButton.disabled = true;
        // submitButton.classList.add("is-loading");
        // Explicit set the button loading action for screen readers
        // srLoadingText.innerText = srLoadingText.dataset.loadingText;

        const data = new FormData(form);
        const result = await submit(Object.fromEntries(data));
        if (result.errorFields) {
            [...fields].forEach((field) => {
                const msg = result.errorFields[field.name];
                if (msg) {
                    setValidation(field, msg);
                }
            })
        }
        // feedback.innerText = result.message;
        // srLoadingText.innerText = "";
        submitButton.dataset.loading = String(false);
        submitButton.disabled = false;
        isSubmitting = false;
    }


    form.addEventListener("submit", (event) => {
        if (isSubmitting) return;
        handleFormSubmit(event);
    });
    submitButton.addEventListener("click", handleFormSubmit);
}
