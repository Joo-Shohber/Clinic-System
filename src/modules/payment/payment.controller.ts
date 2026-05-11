import { Request, Response } from "express";
import * as paymentService from "./payment.service";

export async function createPaymentIntent(
  req: Request,
  res: Response,
): Promise<void> {
  const { clientSecret } = await paymentService.createPaymentIntent(
    req.params.appointmentId as string,
    req.user.userId,
  );
  res.status(200).json({ success: true, data: { clientSecret } });
}

export async function stripeWebhook(
  req: Request,
  res: Response,
): Promise<void> {
  const signature = req.headers["stripe-signature"] as string;
  if (!signature) {
    res.status(400).json({
      success: false,
      error: { code: "MISSING_SIGNATURE", message: "Missing stripe signature" },
    });
    return;
  }

  await paymentService.handleStripeWebhook(req.body as Buffer, signature);
  res.status(200).json({ received: true });
}

export async function refundAppointment(
  req: Request,
  res: Response,
): Promise<void> {
  await paymentService.refundAppointment(req.params.appointmentId as string);
  res
    .status(200)
    .json({ success: true, message: "Refund processed successfully" });
}
