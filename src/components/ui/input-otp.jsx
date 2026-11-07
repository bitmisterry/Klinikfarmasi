// @ts-nocheck -- input-otp exposes polymorphic slot props at runtime.
import * as React from "react"
import { OTPInput, OTPInputContext } from "input-otp"
import { Minus } from "lucide-react"

import { cn } from "@/lib/utils"

const InputOTPImpl = React.forwardRef(({ className, containerClassName, ...props }, ref) => (
  <OTPInput
    ref={ref}
    containerClassName={cn("flex items-center gap-2 has-[:disabled]:opacity-50", containerClassName)}
    className={cn("disabled:cursor-not-allowed", className)}
    {...props} />
))
/** @type {React.ForwardRefExoticComponent<any>} */
const InputOTP = InputOTPImpl
InputOTP.displayName = "InputOTP"

const InputOTPGroupImpl = React.forwardRef(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("flex items-center", className)} {...props} />
))
/** @type {React.ForwardRefExoticComponent<any>} */
const InputOTPGroup = InputOTPGroupImpl
InputOTPGroup.displayName = "InputOTPGroup"

const InputOTPSlotImpl = React.forwardRef(({ index, className, ...props }, ref) => {
  const inputOTPContext = React.useContext(OTPInputContext)
  const { char, hasFakeCaret, isActive } = inputOTPContext.slots[index]

  return (
    (<div
      ref={ref}
      className={cn(
        "relative flex h-9 w-9 items-center justify-center border-y border-r border-input text-sm shadow-sm transition-all first:rounded-l-md first:border-l last:rounded-r-md",
        isActive && "z-10 ring-1 ring-ring",
        className
      )}
      {...props}>
      {char}
      {hasFakeCaret && (
        <div
          className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="h-4 w-px animate-caret-blink bg-foreground duration-1000" />
        </div>
      )}
    </div>)
  );
})
/** @type {React.ForwardRefExoticComponent<any>} */
const InputOTPSlot = InputOTPSlotImpl
InputOTPSlot.displayName = "InputOTPSlot"

const InputOTPSeparatorImpl = React.forwardRef(({ ...props }, ref) => (
  <div ref={ref} role="separator" {...props}>
    <Minus />
  </div>
))
/** @type {React.ForwardRefExoticComponent<any>} */
const InputOTPSeparator = InputOTPSeparatorImpl
InputOTPSeparator.displayName = "InputOTPSeparator"

export { InputOTP, InputOTPGroup, InputOTPSlot, InputOTPSeparator }
