import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { domain, token, rowData, rowNum } = body;

    if (!domain || !token || !rowData) {
      return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 });
    }

    const url = `https://${domain}/admin/api/2024-01/orders.json`;
    
    // Safe parsing for Quantity
    const rawQty = rowData['Quantity'] ? String(rowData['Quantity']).trim() : '1';
    let quantity = parseInt(rawQty, 10);
    if (isNaN(quantity)) quantity = 1;

    // Payment Status
    const rawPaymentStatus = rowData['Payment Status'] ? String(rowData['Payment Status']).trim().toLowerCase() : '';
    const paymentStatus = rawPaymentStatus || 'pending';

    // Tags
    const customTags = rowData['Tags'] ? String(rowData['Tags']).trim() : '';
    const tags = customTags ? `Bulk_App_Import, ${customTags}` : 'Bulk_App_Import';

    const orderData: any = {
      email: rowData['Email'] ? String(rowData['Email']).trim() : '',
      send_receipt: true,
      financial_status: paymentStatus,
      tags: tags,
      line_items: [
        {
          title: rowData['Product Title'] ? String(rowData['Product Title']).trim() : '',
          quantity: quantity,
          price: rowData['Price'] ? String(rowData['Price']).trim() : '0.00'
        }
      ]
    };

    // Optional Customer Data
    const firstName = rowData['First Name'] ? String(rowData['First Name']).trim() : '';
    const lastName = rowData['Last Name'] ? String(rowData['Last Name']).trim() : '';
    
    // Marketing Consent (reads from 'Subscribed' or 'Accepts Marketing' column)
    const rawSubscribed = rowData['Subscribed'] || rowData['Accepts Marketing'] || '';
    const isSubscribed = ['yes', 'true', '1'].includes(String(rawSubscribed).trim().toLowerCase());

    if (orderData.email) {
      orderData.customer = {
        first_name: firstName,
        last_name: lastName,
        email: orderData.email,
        accepts_marketing: isSubscribed
      };
    }

    // Optional Shipping Address
    const address = rowData['Address'] ? String(rowData['Address']).trim() : '';
    const city = rowData['City'] ? String(rowData['City']).trim() : '';
    const province = rowData['State/Province'] ? String(rowData['State/Province']).trim() : '';
    const zipCode = rowData['Zip/Postal'] ? String(rowData['Zip/Postal']).trim() : '';
    const country = rowData['Country'] ? String(rowData['Country']).trim() : '';

    if (address || city || zipCode) {
      orderData.shipping_address = {
        first_name: firstName,
        last_name: lastName,
        address1: address,
        city: city,
        province: province,
        zip: zipCode,
        country: country
      };
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'X-Shopify-Access-Token': token,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ order: orderData })
    });

    const responseData = await response.json();

    if (response.ok) {
      return NextResponse.json({ 
        success: true, 
        orderId: responseData.order?.id,
        message: `Created order for ${orderData.email}`
      });
    } else {
      return NextResponse.json({ 
        success: false, 
        error: responseData.errors || response.statusText,
        status: response.status
      }, { status: response.status });
    }

  } catch (error: any) {
    console.error("API Route Error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
